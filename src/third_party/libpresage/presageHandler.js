import {
  SUPPORTED_LANGUAGES,
  LANG_ADDITIONAL_SEPERATOR_REGEX,
} from "./lang.js";

const NEW_SENTENCE_CHARS = [".", "?", "!"];
const SPACING_RULES = {
  ".": { spaceBefore: false, spaceAfter: true },
  ",": { spaceBefore: false, spaceAfter: true },
  "]": { spaceBefore: false, spaceAfter: true },
  ")": { spaceBefore: false, spaceAfter: true },
  "}": { spaceBefore: false, spaceAfter: true },
  ">": { spaceBefore: false, spaceAfter: true },
  "!": { spaceBefore: false, spaceAfter: true },
  ":": { spaceBefore: false, spaceAfter: true },
  ";": { spaceBefore: false, spaceAfter: true },
  "?": { spaceBefore: false, spaceAfter: true },
  "[": { spaceBefore: true, spaceAfter: false },
  "(": { spaceBefore: true, spaceAfter: false },
  "{": { spaceBefore: true, spaceAfter: false },
  "<": { spaceBefore: true, spaceAfter: false },
  "/": { spaceBefore: true, spaceAfter: true },
  "—": { spaceBefore: false, spaceAfter: false },
  "–": { spaceBefore: false, spaceAfter: false },
  "-": { spaceBefore: false, spaceAfter: false },
  "’": { spaceBefore: false, spaceAfter: false },
  "*": { spaceBefore: false, spaceAfter: false },
  "+": { spaceBefore: false, spaceAfter: false },
  "=": { spaceBefore: false, spaceAfter: false },
};
const SPACE_CHARS = ["\xA0", " "];
const PAST_WORDS_COUNT = 5;
const SUGGESTIIBT_COUNT = 5;
const MIN_WORD_LENGHT_TO_PREDICT = 1;

const Capitalization = Object.freeze({
  FirstLetter: Symbol("letter"),
  WholeWord: Symbol("word"),
  None: Symbol("none"),
});

class PresageHandler {
  constructor(Module) {
    this.Module = Module;
    // last presage prediction per lang
    this.lastPrediction = {};
    // presage timeouts per tabId and frameId
    this.predictionTimeouts = {};
    // libPresage module
    this.libPresage = {};
    this.libPresageCallback = {};
    this.libPresageCallbackImpl = {};
    // Number of suggestion generated by presage engine
    this.numSuggestions = SUGGESTIIBT_COUNT;
    // Minimum characters typed by user to start prediction
    this.minWordLengthToPredict = MIN_WORD_LENGHT_TO_PREDICT;
    // Predict next word after separator char
    this.predictNextWordAfterSeparatorChar = MIN_WORD_LENGHT_TO_PREDICT === 0;
    // Automatically insert space after autocomplete
    this.insertSpaceAfterAutocomplete = true;
    // Capitalize the first word of each sentence
    this.autoCapitalize = true;
    // Apply SPACING_RULES
    this.applySpacingRules = false;
    // Text Expander config
    this.textExpansions = [];
    //Precompiled regular expressions
    this.separatorCharRegEx = RegExp(
      /\s+|!|"|#|\$|%|&|\(|\)|\*|\+|,|-|\.|\/|:|;|<|=|>|\?|@|\[|\\|\]|\^|_|`|{|\||}|~/
    );
    // Subset of separatorCharRegEx - keep predicting after those chars
    this.keepPredCharRegEx = RegExp(/\[|\(|{|<|\/|-|\*|\+|=|"/);
    this.whiteSpaceRegEx = RegExp(/\s+/);
    this.letterRegEx = RegExp(/^\p{L}/, "u");
    // Attach event listener
    window.addEventListener("message", this.messageHandler.bind(this));
    for (const [lang] of Object.entries(SUPPORTED_LANGUAGES)) {
      try {
        this.lastPrediction[lang] = { pastStream: "", predictions: [] };
        this.libPresageCallback[lang] = {
          pastStream: "",

          get_past_stream: function () {
            return this.pastStream;
          },

          get_future_stream: function () {
            return "";
          },
        };
        this.libPresageCallbackImpl[lang] =
          this.Module.PresageCallback.implement(this.libPresageCallback[lang]);
        this.libPresage[lang] = new this.Module.Presage(
          this.libPresageCallbackImpl[lang],
          "resources_js/" + lang + "/presage.xml"
        );
      } catch (error) {
        console.log(
          "Failed to create Presage instance for %s language: %s",
          lang,
          error
        );
      }
    }
  }

  runPredictionHandler(event) {
    const context = {
      ...event.data.context,
      predictions: [],
      forceReplace: null,
      triggerInputEvent: this.insertSpaceAfterAutocomplete,
    };
    const message = {
      command: "sandBoxPredictResp",
      context: context,
    };
    const result = this.runPrediction(
      event.data.context.text,
      event.data.context.nextChar,
      event.data.context.lang
    );
    message.context.predictions = result.predictions;
    message.context.forceReplace = result.forceReplace;
    this.predictionTimeouts[event.data.context.tabId][
      event.data.context.frameId
    ] = null;
    event.source.postMessage(message, event.origin);
  }

  messageHandler(event) {
    const command = event.data.command;
    const context = event.data.context;
    switch (command) {
      case "backgroundPagePredictReq": {
        const tabId = event.data.context.tabId;
        const frameId = event.data.context.frameId;
        if (!this.predictionTimeouts[tabId]) {
          this.predictionTimeouts[tabId] = {};
        } else if (this.predictionTimeouts[tabId][frameId]) {
          clearTimeout(this.predictionTimeouts[tabId][frameId]);
        }
        this.predictionTimeouts[tabId][frameId] = setTimeout(
          this.runPredictionHandler.bind(this, event),
          0
        );
        break;
      }
      case "backgroundPageSetConfig": {
        this.setConfig(
          context.numSuggestions,
          context.minWordLengthToPredict,
          context.insertSpaceAfterAutocomplete,
          context.autoCapitalize,
          context.applySpacingRules,
          context.textExpansions
        );
        break;
      }
      default:
        console.log("Unknown message:");
        console.log(event);
    }
  }

  setupTextExpansions() {
    if (!this.textExpansions) return;

    let str = "";
    this.textExpansions.forEach((textExpansion) => {
      str += `${textExpansion[0].toLowerCase()}\t${textExpansion[1]}\n`;
    });
    this.Module.FS.writeFile("/textExpansions.txt", str);
    for (const [, libPresage] of Object.entries(this.libPresage)) {
      libPresage.config(
        "Presage.Predictors.DefaultAbbreviationExpansionPredictor.ABBREVIATIONS",
        "/textExpansions.txt"
      );
    }
  }

  setConfig(
    numSuggestions,
    minWordLengthToPredict,
    insertSpaceAfterAutocomplete,
    autoCapitalize,
    applySpacingRules,
    textExpansions
  ) {
    this.numSuggestions = numSuggestions;
    this.minWordLengthToPredict = minWordLengthToPredict;
    this.predictNextWordAfterSeparatorChar = minWordLengthToPredict === 0;
    this.insertSpaceAfterAutocomplete = insertSpaceAfterAutocomplete;
    this.autoCapitalize = autoCapitalize;
    this.applySpacingRules = applySpacingRules;
    this.textExpansions = textExpansions;
    this.setupTextExpansions();

    for (const [, libPresage] of Object.entries(this.libPresage)) {
      libPresage.config(
        "Presage.Selector.SUGGESTIONS",
        this.numSuggestions.toString()
      );
    }
  }

  isWhiteSpace(character) {
    return this.whiteSpaceRegEx.test(character);
  }

  isLetter(character) {
    return this.letterRegEx.test(character);
  }

  countDigits(str) {
    return str.replace(/[^0-9]/g, "").length;
  }

  isNumber(str) {
    // the string is a number, or there are at least two digits in it
    return (
      (!isNaN(str) && !isNaN(parseFloat(str))) || this.countDigits(str) > 1
    );
  }

  removePrevSentence(wordArrayOrig) {
    // Check for new sentence start
    // Use only words from new setence for prediction
    let newSentence = false;
    // Make copy of the array
    let wordArray = wordArrayOrig.slice();
    for (let index = wordArray.length - 1; index >= 0; index--) {
      const element = wordArray[index];

      if (
        // Checks for "." in wordArray
        NEW_SENTENCE_CHARS.includes(element) ||
        //Checks for "WORD." in wordArray
        NEW_SENTENCE_CHARS.includes(element.slice(-1))
      ) {
        wordArray = wordArray.splice(index + 1);
        newSentence = true;
        break;
      }
    }
    return { wordArray, newSentence };
  }

  // Check if autoCapitalize should be run
  checkAutoCapitalize(tokensArray, newSentence, endsWithSpace) {
    const lastWord = tokensArray.length
      ? tokensArray[tokensArray.length - 1]
      : "";
    const firstCharacterOfLastWord = lastWord.slice(0, 1);

    // Handle following case:
    // Prediction input meets the conditions:
    //   * doesn't end with whitespace
    //   * first letter of last word is uppercase
    //   * word is at least 2 characters
    //   * eg.  " XYZ"
    if (
      !endsWithSpace &&
      lastWord &&
      lastWord.length > 1 &&
      lastWord === lastWord.toUpperCase()
    )
      return Capitalization.WholeWord;

    // Handle following case:
    // Prediction input meets the conditions:
    //   * doesn't end with whitespace
    //   * first letter of last word is uppercase
    //   * eg.  " Xyz"
    if (
      !endsWithSpace &&
      this.isLetter(firstCharacterOfLastWord) &&
      firstCharacterOfLastWord === firstCharacterOfLastWord.toUpperCase()
    )
      return Capitalization.FirstLetter;

    // Handle following case:
    // Auto Capitalize is enabled and
    // Prediction input meets the conditions:
    //   * it includes one of NEW_SENTENCE_CHARS and there is exacly one word after it
    //       and last word doesn't end with whitespace
    //   * or it includes one of NEW_SENTENCE_CHARS and there are no words after it
    //       and it ends with whitespace
    //   * eg.  "xyz. xyz" or "xyz. "
    if (
      this.autoCapitalize &&
      newSentence &&
      ((!endsWithSpace && tokensArray.length === 1) ||
        (endsWithSpace && tokensArray.length === 0))
    )
      return Capitalization.FirstLetter;

    return Capitalization.None;
  }

  // Check if prediction should be run
  checkDoPrediction(lastWord, endsWithSpace) {
    // Num suggestions set to zero - disable prediction
    if (this.numSuggestions <= 0) return false;

    // Don't run precition on numbers
    if (!endsWithSpace && this.isNumber(lastWord)) return false;

    // Input ends with whitespace and minimum word length to start prediction is not set to 0 eg. "xyz abc "
    if (endsWithSpace && !this.predictNextWordAfterSeparatorChar) return false;

    // Word is too short to start prediction
    if (!endsWithSpace && lastWord.length < this.minWordLengthToPredict)
      return false;

    // Last word includes separator char eg. "xyc@abc", "zyz?abc"
    if (
      !endsWithSpace &&
      (lastWord.match(this.separatorCharRegEx) || []).length !==
        (lastWord.match(this.keepPredCharRegEx) || []).length
    )
      return false;

    return true;
  }

  processInput(predictionInput, language) {
    let doCapitalize = false;
    let doPrediction = false;
    if (
      typeof predictionInput !== "string" &&
      !(predictionInput instanceof String)
    )
      return { predictionInput, doPrediction, doCapitalize };
    const endsWithSpace = predictionInput !== predictionInput.trimEnd();
    // Workaround; Lang specific separator chars should be handled by Presage
    if (LANG_ADDITIONAL_SEPERATOR_REGEX[language]) {
      predictionInput = predictionInput.replace(
        LANG_ADDITIONAL_SEPERATOR_REGEX[language],
        " "
      );
    }
    // Get last PAST_WORDS_COUNT words and filter empty
    const lastWordsArray = predictionInput
      .split(this.whiteSpaceRegEx) // Split on any whitespace
      .filter(function (e) {
        return e.trim(); // filter empty elements
      })
      .splice(-PAST_WORDS_COUNT); // Get last PAST_WORDS_COUNT words
    const { wordArray, newSentence } = this.removePrevSentence(lastWordsArray);
    predictionInput = wordArray.join(" ") + (endsWithSpace ? " " : "");
    let lastWord = lastWordsArray.length
      ? lastWordsArray[lastWordsArray.length - 1]
      : "";
    lastWord =
      lastWord
        .split(this.keepPredCharRegEx) // Split on keepPredCharRegEx
        .filter(function (e) {
          return e.trim(); // filter empty elements
        })
        .pop() || "";

    doCapitalize = this.checkAutoCapitalize(
      wordArray,
      newSentence,
      endsWithSpace
    );

    doPrediction = this.checkDoPrediction(lastWord, endsWithSpace);

    return { predictionInput, doPrediction, doCapitalize };
  }

  spacingRulesHandler(inputStr) {
    if (!inputStr) return;

    const lastChar = inputStr[inputStr.length - 1];
    const lastCharMin1 = inputStr[inputStr.length - 2];
    const lastCharMin2 = inputStr[inputStr.length - 3];

    if (!lastCharMin1) return null;
    if (!(lastChar in SPACING_RULES)) return null;
    if (SPACE_CHARS.includes(lastCharMin2)) return null;
    if (
      SPACING_RULES[lastChar].spaceBefore === SPACE_CHARS.includes(lastCharMin1)
    )
      return null;

    const txt =
      (SPACING_RULES[lastChar].spaceBefore ? "\xA0" : "") +
      lastChar +
      (this.insertSpaceAfterAutocomplete && SPACING_RULES[lastChar].spaceAfter
        ? "\xA0"
        : "");

    return {
      text: txt,
      length: 2 - SPACING_RULES[lastChar].spaceBefore,
    };
  }

  doPredictionHandler(predictionInput, lang) {
    if (predictionInput === this.lastPrediction[lang].pastStream) {
      return this.lastPrediction[lang].predictions;
    }

    // Do prediction
    this.libPresageCallback[lang].pastStream = predictionInput;
    const predictions = [];
    const predictionsNative = this.libPresage[lang].predictWithProbability();
    for (let i = 0; i < predictionsNative.size(); i++) {
      const result = predictionsNative.get(i);
      predictions.push(result.prediction);
      //result.probability
    }
    this.lastPrediction[lang].pastStream = predictionInput;
    this.lastPrediction[lang].predictions = predictions;

    return predictions;
  }

  runPrediction(text, nextChar, lang) {
    let predictions = [];
    let forceReplace = null;
    const { predictionInput, doPrediction, doCapitalize } = this.processInput(
      text,
      lang
    );
    if (this.applySpacingRules) {
      forceReplace = this.spacingRulesHandler(text);
    }

    if (!this.libPresage[lang]) {
      // Do nothing reply with empty predictions
    } else if (
      // Do prediction
      !forceReplace &&
      doPrediction
    ) {
      predictions = this.doPredictionHandler(predictionInput, lang);
    }
    // Add space if needed
    if (this.insertSpaceAfterAutocomplete) {
      if (
        !this.isWhiteSpace(nextChar) &&
        (!(nextChar in SPACING_RULES) ||
          SPACING_RULES[nextChar].spaceBefore === true)
      ) {
        predictions = predictions.map((pred) => `${pred}\xA0`);
      }
    }

    switch (doCapitalize) {
      case Capitalization.FirstLetter:
        predictions = predictions.map(
          (pred) => pred.charAt(0).toUpperCase() + pred.slice(1)
        );
        break;
      case Capitalization.WholeWord:
        predictions = predictions.map((pred) => pred.toUpperCase());
        break;
      case Capitalization.None:
      default:
    }

    return { predictions, forceReplace };
  }
}

export { PresageHandler };
