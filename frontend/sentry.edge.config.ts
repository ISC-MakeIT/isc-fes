import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./src/shared/config/sentry";

Sentry.init(sentryOptions);
