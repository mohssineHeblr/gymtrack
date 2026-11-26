// Lets Node run the TypeScript seed script: resolves extensionless relative imports to .ts files.
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (e) {
    if ((specifier.startsWith(".") || specifier.startsWith("/")) && !/\\.[cm]?[jt]s$/.test(specifier)) {
      return next(specifier + ".ts", context);
    }
    throw e;
  }
}`),
  import.meta.url,
);
