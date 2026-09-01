import fs from "node:fs/promises";

const MENU_FILE = "menu.json";
const apiKey = process.env.DEEPL_API_KEY;

if (!apiKey) {
  throw new Error("DEEPL_API_KEY is missing.");
}

const menu = JSON.parse(
  await fs.readFile(MENU_FILE, "utf8")
);

const fieldsToTranslate = [];

function addTranslationField(object, fieldName) {
  const field = object?.[fieldName];

  if (
    field &&
    typeof field.fr === "string" &&
    field.fr.trim() !== ""
  ) {
    fieldsToTranslate.push({
      field,
      french: field.fr
    });
  }
}

/* Category names + dishes */
for (const category of menu.categories ?? []) {
  addTranslationField(category, "name");

  for (const dish of category.dishes ?? []) {
    addTranslationField(dish, "name");
    addTranslationField(dish, "description");
  }
}

/* Set menu */
if (menu.formula) {
  addTranslationField(menu.formula, "label");
  addTranslationField(menu.formula, "description");
}

if (fieldsToTranslate.length === 0) {
  console.log("Nothing to translate.");
  process.exit(0);
}

const texts = fieldsToTranslate.map(
  item => item.french
);

/*
  Older Free API keys end in :fx.
  Developer/Growth keys use the normal API endpoint.
*/
const apiBase = apiKey.endsWith(":fx")
  ? "https://api-free.deepl.com"
  : "https://api.deepl.com";

const response = await fetch(
  `${apiBase}/v2/translate`,
  {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: texts,
      source_lang: "FR",
      target_lang: "EN-GB"
    })
  }
);

if (!response.ok) {
  const errorText = await response.text();

  throw new Error(
    `DeepL error ${response.status}: ${errorText}`
  );
}

const result = await response.json();

if (
  !result.translations ||
  result.translations.length !== fieldsToTranslate.length
) {
  throw new Error(
    "DeepL returned an unexpected number of translations."
  );
}

/* Put every English translation back into menu.json */
result.translations.forEach((translation, index) => {
  fieldsToTranslate[index].field.en = translation.text;
});

await fs.writeFile(
  MENU_FILE,
  JSON.stringify(menu, null, 2) + "\n",
  "utf8"
);

console.log(
  `Translated ${fieldsToTranslate.length} menu fields from French to English.`
);
