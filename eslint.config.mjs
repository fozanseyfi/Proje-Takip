import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-sandbox/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      /**
       * Türkçe metinlerde apostrof (') sıklıkla kullanılır (örn. "Proje'nin",
       * "Faz'ın"). JSX'te bunları `&apos;`'ya çevirmek metni okunmaz hale
       * getirir + Türkçe karakter desteği zaten Unicode ile var. Bu kuralı
       * kapatmak hem geliştirici deneyimi hem sonuç kalitesi için iyi.
       */
      "react/no-unescaped-entities": "off",

      /**
       * Bilinçli "_" prefix'li unused var'lara izin (örn. catch (_err)),
       * sadece prefix'siz unused'ları uyar.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],

      /**
       * React Compiler / Next.js 16'nın yeni eklediği iki kural — production
       * için sıklıkla "false positive" (seed/persist/init flow'larında).
       * Build'i kırmasın, warn seviyesinde tut; daha sonra tek tek refactor
       * yapılır (PAKET 4 — performance).
       */
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
