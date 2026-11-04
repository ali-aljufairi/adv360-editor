import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules/**', '.output/**', 'src/routeTree.gen.ts'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
)
