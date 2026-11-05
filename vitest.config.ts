import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // デフォルトは node（Server Action テスト用）
    // コンポーネントテストは各ファイルで @vitest-environment jsdom を指定
    environment: "node",
  },
  // JSX transform は tsconfig の "jsx": "react-jsx" を oxc が参照するため設定不要
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
});
