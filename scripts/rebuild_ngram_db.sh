
#!/usr/bin/env sh

set -eu

MAX_FILES=20
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source "${SCRIPT_DIR}"/langs.sh
OSCAR_CORUPS_VERSION="OSCAR-2301"
LANGUAGE_DETECTION_PROB="0.9"
HARMFUL_SCORE="250.0"

trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

waitforjobs() {
    while test $(jobs -p | wc -w) -ge "$1"; do wait -n; done
}

download_and_extract() {
    FILE_PATH=$1
    LANG=$2
    WORK_DIR=$3

    if [ ! -f "${FILE_PATH}" ]; then
        git lfs pull --include "${FILE_PATH}.zst"
        if [ ! -f "${FILE_PATH}.zst" ]; then
            echo "${FILE_PATH}.zst not found"
            return 0
        fi
        echo "Decompressing ${FILE_PATH}.zst"
        unzstd "${FILE_PATH}.zst"
    fi

    waitforjobs 8

    # Filter content
    echo "Extracting data from ${FILE_PATH}"
    jq -r 'select( .metadata.quality_warnings == null) |
        select ( .metadata.identification.prob >= '${LANGUAGE_DETECTION_PROB}') |
        select ( .metadata.harmful_pp >= '${HARMFUL_SCORE}') |
        .content ' \
    "${FILE_PATH}" >> "${WORK_DIR}/${LANG}_sentences_${i}.txt" && \
    hunspell -i utf-8 -d "${LANGS_HUNSPELL[${lang}]}" -G -L "${WORK_DIR}/${LANG}_sentences_${i}.txt" >  "${WORK_DIR}/${LANG}_sentences_checked_${i}.txt"  && \
    rm -rf "${WORK_DIR}/${LANG}_sentences_${i}.txt" &
}

cd "${SCRIPT_DIR}"
if [ ! -d ${OSCAR_CORUPS_VERSION} ]; then
    GIT_LFS_SKIP_SMUDGE=1 git clone https://huggingface.co/datasets/oscar-corpus/${OSCAR_CORUPS_VERSION}
fi

cd ${OSCAR_CORUPS_VERSION}
WORK_DIR="${SCRIPT_DIR}/tmp"
mkdir -p "${WORK_DIR}"
git lfs install

for lang in "${LANGS[@]}"
do
    if [ "$lang" = "hr" ]; then
        echo "Low quality HR dataset, skipping"
        continue
    fi
    FILE_COUNT=$(ls "${lang}"_meta/"${lang}"_meta_part_*.zst |wc -l)
    FILE_STEP=$((${FILE_COUNT} / ${MAX_FILES}))
    FILE_MAX=$((${FILE_STEP} * ${MAX_FILES}))

    SENTENCES_FILE="${WORK_DIR}/${lang}_sentences.txt"
    rm -rf "${SENTENCES_FILE}"
    
    for i in $(seq 1 $FILE_STEP $FILE_MAX)
    do
        FILE_NAME="${lang}_meta_part_${i}.jsonl"
        FILE_PATH="${lang}_meta/${FILE_NAME}"
        download_and_extract "$FILE_PATH" "$lang" "$WORK_DIR"
    done    
done

echo "Waiting for download background jobs to complete"
wait

for lang in "${LANGS[@]}"
do
    if [ "$lang" = "hr" ]; then
        echo "Low quality HR dataset, skipping"
        continue
    fi
    # Merge spellchecked files
    cat "${WORK_DIR}"/"${lang}"_sentences_checked_*.txt > "${WORK_DIR}/${lang}_sentences_checked.txt"
    rm -rf "${WORK_DIR}"/"${lang}"_sentences_checked_*.txt 
    
    # Generate ngrams 
    python3 "${SCRIPT_DIR}"/gen_ngram.py -i "${WORK_DIR}/${lang}_sentences_checked.txt" -l en
    # generate marisa-trie database from ngrams
    python3 "${SCRIPT_DIR}"/ngramtxt2marisa.py --overwrite --output "${SCRIPT_DIR}"/../resources_js/"${lang}"/ngrams_db/ --inputfile "${WORK_DIR}/${lang}_sentences_checked_ngram_merged.txt"
done


git lfs prune