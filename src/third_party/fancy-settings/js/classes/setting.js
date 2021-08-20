//
// Copyright (c) 2011 Frank Kohlhepp
// https://github.com/frankkohlhepp/fancy-settings
// License: LGPL v2.1
//

import { Store } from "../../lib/store.js";
import { Events, ElementWrapper, getUniqueID } from "./utils.js";

const settings = new Store("settings");

class Bundle extends Events {
  // Attributes:
  // - tab
  // - group
  // - name
  // - type
  //
  // Methods:
  //  - constructor
  //  - createDOM
  //  - setupDOM
  //  - addEvents
  //  - get
  //  - set
  // Implements: Events;

  constructor(params) {
    super(params);
    this.params = params;

    this.createDOM();
    this.setupDOM();
    this.addEvents();

    if (this.params.name !== undefined) {
      this.set(settings.get(this.params.name), true);
    }
  }

  addEvents() {
    this.element.addEvent(
      "change",
      function (event) {
        if (this.params.name !== undefined) {
          settings.set(this.params.name, this.get());
        }

        this.fireEvent("action", this.get());
      }.bind(this)
    );
  }

  get() {
    return this.element.get("value");
  }

  set(value, noChangeEvent) {
    this.element.set("value", value);

    if (noChangeEvent !== true) {
      this.element.fireEvent("change");
    }

    return this;
  }
}

class Description extends Bundle {
  // text

  constructor(params) {
    super(params);
    this.params = params;

    this.createDOM();
    this.setupDOM();
  }

  createDOM() {
    this.bundle = new ElementWrapper("div", {});

    this.container = new ElementWrapper("div", {});

    this.element = new ElementWrapper("p", {});
  }

  setupDOM() {
    if (this.params.text !== undefined) {
      this.element.set("innerHTML", this.params.text);
    }

    this.element.inject(this.container);
    this.container.inject(this.bundle);
  }
}

class Button extends Bundle {
  // label, text
  // action -> click

  constructor(params) {
    super(params);
    this.params = params;

    this.createDOM();
    this.setupDOM();
    this.addEvents();
  }

  createDOM() {
    this.bundle = new ElementWrapper("div", {
      class: "field",
    });

    this.container = new ElementWrapper("div", {
      class: "control",
    });

    this.element = new ElementWrapper("input", {
      class: "button is-primary is-outlined",
      type: "button",
    });

    this.label = new ElementWrapper("label", {});
  }

  setupDOM() {
    if (this.params.label !== undefined) {
      this.label.set("innerHTML", this.params.label);
      this.label.inject(this.container);
    }

    if (this.params.text !== undefined) {
      this.element.set("value", this.params.text);
    }

    this.element.inject(this.container);
    this.container.inject(this.bundle);
  }

  addEvents() {
    this.element.addEvent(
      "click",
      function () {
        this.fireEvent("action");
      }.bind(this)
    );
  }
}

class Text extends Bundle {
  // label, text, masked
  // action -> change & keyup

  createDOM() {
    this.bundle = new ElementWrapper("div", {
      class: "setting bundle text",
    });

    this.container = new ElementWrapper("div", {
      class: "setting container text",
    });

    if (this.params.colorPicker === true) {
      this.element = new ElementWrapper("input", {
        class: "color",
        type: "text",
      });
    } else {
      this.element = new ElementWrapper("input", {
        class: "setting element text",
        type: "text",
      });
    }

    this.label = new ElementWrapper("label", {
      class: "setting label text",
    });
  }

  setupDOM() {
    if (this.params.label !== undefined) {
      this.label.set("innerHTML", this.params.label);
      this.label.inject(this.container);
    }

    if (this.params.text !== undefined) {
      this.element.set("placeholder", this.params.text);
    }

    if (this.params.masked === true) {
      this.element.set("type", "password");
    }

    this.element.inject(this.container);
    this.container.inject(this.bundle);
  }

  addEvents() {
    const change = function (event) {
      if (this.params.name !== undefined) {
        if (this.params.store !== false) {
          settings.set(this.params.name, this.get());
        }
      }

      this.fireEvent("action", this.get());
    }.bind(this);

    this.element.addEvent("change", change);
    this.element.addEvent("keyup", change);
  }
}

class Checkbox extends Bundle {
  // label
  // action -> change

  createDOM() {
    this.bundle = new ElementWrapper("div", { class: "field" });

    this.container = new ElementWrapper("div", {
      class: "control",
    });

    let id = getUniqueID();
    this.element = new ElementWrapper("input", {
      id: id,
      name: id,
      class: "switch",
      type: "checkbox",
      value: "true",
    });

    this.label = new ElementWrapper("label", {
      for: this.element.get("id"),
    });
  }

  setupDOM() {
    this.element.inject(this.container);
    this.container.inject(this.bundle);

    if (this.params.label !== undefined) {
      this.label.set("innerHTML", this.params.label);
      this.label.inject(this.container);
    }
  }

  get() {
    return this.element.get("checked");
  }

  set(value, noChangeEvent) {
    this.element.set("checked", value);

    if (noChangeEvent !== true) {
      this.element.fireEvent("change");
    }

    return this;
  }
}

class Slider extends Bundle {
  // label, max, min, step, display, displayModifier
  // action -> change

  constructor(params) {
    super(params);
    this.params = params;

    this.createDOM();
    this.setupDOM();
    this.addEvents();

    if (this.params.name !== undefined) {
      this.set(settings.get(this.params.name) || 0, true);
    } else {
      this.set(0, true);
    }
  }

  createDOM() {
    this.bundle = new ElementWrapper("div", {
      class: "field",
    });

    this.container = new ElementWrapper("div", {
      class: "control",
    });

    this.element = new ElementWrapper("input", {
      name: getUniqueID(),
      class:
        "slider is-fullwidth" +
        (this.params.display === true ? " has-output" : ""),
      type: "range",
    });

    this.label = new ElementWrapper("label", {});

    this.display = new ElementWrapper("output", {
      for: this.element.get("name"),
    });
  }

  setupDOM() {
    if (this.params.label !== undefined) {
      this.label.set("innerHTML", this.params.label);
      this.label.inject(this.container);
    }

    if (this.params.max !== undefined) {
      this.element.set("max", this.params.max);
    }

    if (this.params.min !== undefined) {
      this.element.set("min", this.params.min);
    }

    if (this.params.step !== undefined) {
      this.element.set("step", this.params.step);
    }

    this.element.inject(this.container);
    if (this.params.display === true) {
      if (this.params.displayModifier !== undefined) {
        this.display.set("innerText", this.params.displayModifier(0));
      } else {
        this.display.set("innerText", 0);
      }
      this.display.inject(this.container);
    }
    this.container.inject(this.bundle);
  }

  addEvents() {
    this.element.addEvent(
      "input",
      function (event) {
        if (this.params.name !== undefined) {
          settings.set(this.params.name, this.get());
        }

        if (this.params.displayModifier !== undefined) {
          this.display.set(
            "innerText",
            this.params.displayModifier(this.get())
          );
        } else {
          this.display.set("innerText", this.get());
        }
        this.fireEvent("action", this.get());
      }.bind(this)
    );
  }

  get() {
    return Number(this.element.get("value"));
  }

  set(value, noChangeEvent) {
    this.element.set("value", value);

    if (noChangeEvent !== true) {
      this.element.fireEvent("change");
    } else {
      if (this.params.displayModifier !== undefined) {
        this.display.set(
          "innerText",
          this.params.displayModifier(Number(value))
        );
      } else {
        this.display.set("innerText", Number(value));
      }
    }

    return this;
  }
}

class PopupButton extends Bundle {
  // label, options[{value, text}]
  // action -> change

  createDOM() {
    this.bundle = new ElementWrapper("div", {
      class: "field",
    });

    this.control = new ElementWrapper("div", {
      class: "control",
    });
    this.container = new ElementWrapper("div", {
      class: "select",
    });

    this.element = new ElementWrapper("select", {});

    this.label = new ElementWrapper("label", {});

    if (this.params.options === undefined) {
      return;
    }

    // convert array syntax into object syntax for options
    function arrayToObject(option) {
      if (Array.isArray(option)) {
        option = {
          value: option[0],
          text: option[1] || option[0],
        };
      }
      return option;
    }

    // convert arrays
    if (Array.isArray(this.params.options)) {
      const values = [];
      this.params.options.forEach((option) => {
        values.push(arrayToObject(option));
      });
      this.params.options = {
        values: values,
      };
    }

    let groups;
    if (this.params.options.groups !== undefined) {
      groups = {};
      this.params.options.groups.each(
        function (groups, group) {
          groups[group] = new ElementWrapper("optgroup", {
            label: group,
          }).inject(this.element);
        }.bind(this, groups)
      );
    }

    if (this.params.options.values !== undefined) {
      this.params.options.values.forEach((option) => {
        option = arrayToObject(option);

        // find the parent of this option - either a group or the main element
        let parent;
        if (option.group && this.params.options.groups) {
          if (option.group - 1 in this.params.options.groups) {
            option.group = this.params.options.groups[option.group - 1];
          }
          if (option.group in groups) {
            parent = groups[option.group];
          } else {
            parent = this.element;
          }
        } else {
          parent = this.element;
        }

        new ElementWrapper("option", {
          value: option.value,
          text: option.text || option.value,
        }).inject(parent);
      });
    }
  }

  setupDOM() {
    if (this.params.label !== undefined) {
      this.label.set("innerHTML", this.params.label);
      this.label.inject(this.bundle);
    }

    this.element.inject(this.container);
    this.container.inject(this.control);
    this.control.inject(this.bundle);
  }
}

class ListBox extends PopupButton {
  // label, options[{value, text}]
  // action -> change

  add(domainURL) {
    if (this.params.options.indexOf(domainURL) === -1) {
      this.params.options.push(domainURL);
      const elem = new ElementWrapper("option", {
        value: domainURL,
        text: domainURL,
      });
      elem.inject(this.element);
      settings.set(this.params.name, this.params.options);
    }
  }

  remove() {
    if (this.selected) {
      this.selected.forEach((element) => {
        const idx = this.params.options.indexOf(
          element.get("value").toString()
        );
        if (idx !== -1) {
          this.params.options.splice(idx, 1);
          settings.set(this.params.name, this.params.options);
          element.dispose();
          element = null;
        }
      });
    }
  }

  addEvents() {
    const change = function (event) {
      if (this.params.name !== undefined) {
        this.selected = this.element.getSelected();
        // settings.set(this.params.names, this.get());
      }
      // this.fireEvent("action", this.get());
    }.bind(this);

    this.element.addEvent("change", change);
  }

  setupDOM() {
    this.selected = null;
    this.params.options = [];

    let initParams = settings.get(this.params.name);
    if (initParams) {
      this.params.options = initParams;
    }
    try {
      this.params.options.every(
        function (option) {
          if (option) {
            new ElementWrapper("option", {
              value: option,
              text: option,
            }).inject(this.element);
          }
          return true;
        }.bind(this)
      );
    } catch (e) {}

    this.element.inject(this.container);
    this.container.inject(this.control);
    this.control.inject(this.bundle);
  }

  createDOM() {
    this.bundle = new ElementWrapper("div", {
      class: "field",
    });

    this.control = new ElementWrapper("div", {
      class: "control",
    });
    this.container = new ElementWrapper("div", {
      class: "select is-multiple is-fullwidth",
    });

    this.element = new ElementWrapper("select", {
      multiple: true,
      size: "10",
    });

    this.label = new ElementWrapper("label", {
      class: "setting label list-box",
    });
    if (this.params.options === undefined) {
      return;
    }
    this.params.options.every(
      function (option) {
        new ElementWrapper("option", {
          value: option,
          text: option,
        }).inject(this.element);
        return true;
      }.bind(this)
    );
  }

  set() {
    // Do notohing for set - get selected elemenent on keydown event
    // settings.set(this.params.name, this.params.options.join("|@|"));
  }

  get() {
    return this.params.options;
    //            return (this.element.get("value") || undefined);
  }
}

class RadioButtons extends Bundle {
  // label, options[{value, text}]
  // action -> change

  createDOM() {
    const settingID = getUniqueID();

    this.bundle = new ElementWrapper("div", {
      class: "setting bundle radio-buttons",
    });

    this.label = new ElementWrapper("label", {
      class: "setting label radio-buttons",
    });

    this.containers = [];
    this.elements = [];
    this.labels = [];

    if (this.params.options === undefined) {
      return;
    }
    this.params.options.each(
      function (option) {
        const optionID = getUniqueID();
        const container = new ElementWrapper("div", {
          class: "setting container radio-buttons",
        }).inject(this.bundle);
        this.containers.push(container);

        this.elements.push(
          new ElementWrapper("input", {
            id: optionID,
            name: settingID,
            class: "setting element radio-buttons",
            type: "radio",
            value: option[0],
          }).inject(container)
        );

        this.labels.push(
          new ElementWrapper("label", {
            class: "setting element-label radio-buttons",
            for: optionID,
            text: option[1] || option[0],
          }).inject(container)
        );
      }.bind(this)
    );
  }

  setupDOM() {
    if (this.params.label !== undefined) {
      this.label.set("innerHTML", this.params.label);
      this.label.inject(this.bundle, "top");
    }
  }

  addEvents() {
    this.bundle.addEvent(
      "change",
      function (event) {
        if (this.params.name !== undefined) {
          settings.set(this.params.name, this.get());
        }

        this.fireEvent("action", this.get());
      }.bind(this)
    );
  }

  get() {
    const checkedEl = this.elements.filter(function (el) {
      return el.get("checked");
    });
    return checkedEl[0] && checkedEl[0].get("value");
  }

  set(value, noChangeEvent) {
    const desiredEl = this.elements.filter(function (el) {
      return el.get("value") === value;
    });
    desiredEl[0] && desiredEl[0].set("checked", true);

    if (noChangeEvent !== true) {
      this.bundle.fireEvent("change");
    }

    return this;
  }
}

class Setting {
  constructor(container) {
    this.container = container;
  }

  create(params) {
    // Available types
    const types = {
      description: Description,
      button: Button,
      text: Text,
      checkbox: Checkbox,
      slider: Slider,
      popupButton: PopupButton,
      listBox: ListBox,
      radioButtons: RadioButtons,
    };

    if (Object.prototype.hasOwnProperty.call(types, params.type)) {
      const bundle = new types[params.type](params);
      bundle.bundleContainer = this.container;
      bundle.bundle.inject(this.container);
      return bundle;
    } else {
      throw new Error("invalidType");
    }
  }
}

export { Setting };
