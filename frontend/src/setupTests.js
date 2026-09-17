// React Router uses these Web APIs; Jest's jsdom environment needs Node's equivalents.
import { TextDecoder, TextEncoder } from "util";
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
