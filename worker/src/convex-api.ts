/**
 * Convex API reference for the worker.
 *
 * We use `anyApi` from convex/server directly instead of importing the
 * generated api from the web package, which avoids cross-workspace
 * module resolution issues. At runtime the behavior is identical —
 * anyApi is a proxy that constructs function references by name.
 */
import { anyApi } from "convex/server";

export const api = anyApi as any;
