import { expect, test } from "bun:test";
import { companionFailureDiagnostics } from "./companion.ts";

test("diagnostics expose only fixed categories and valid HTTP status", () => {
  const error = Object.assign(new Error("secret request and response"), {
    statusCode: 404, responseBody: "api-key-secret", requestBodyValues: { prompt: "private note" },
    url: "https://provider.example?key=secret",
  });
  expect(companionFailureDiagnostics(error)).toEqual({ reason: "http", status: 404 });
  expect(companionFailureDiagnostics(new Error("provider-secret"))).toBeUndefined();
  for (const status of [200, 400.5, 600, NaN, "401"]) {
    expect(companionFailureDiagnostics({ status })).toBeUndefined();
  }
});

test("distinguishes stream validation, network, empty output, and output limit", () => {
  for (const name of ["AI_InvalidResponseDataError", "AI_JSONParseError", "AI_TypeValidationError"]) {
    expect(companionFailureDiagnostics({ name, message: "secret" })).toEqual({ reason: "invalidResponse" });
  }
  expect(companionFailureDiagnostics(new TypeError("Failed to fetch"))).toEqual({ reason: "network" });
  expect(companionFailureDiagnostics(new TypeError("Cannot read property"))).toBeUndefined();
  expect(companionFailureDiagnostics(new Error("No text returned."))).toEqual({ reason: "emptyResponse" });
  expect(companionFailureDiagnostics(new Error("Response limit exceeded."))).toEqual({ reason: "responseLimit" });
});


test("classifies wrapped network errors without exposing cause data or looping", () => {
  expect(companionFailureDiagnostics({ name: "AI_APICallError", cause: new TypeError("fetch failed") })).toEqual({ reason: "network" });
  expect(companionFailureDiagnostics(new Error("net::ERR_CONNECTION_REFUSED"))).toEqual({ reason: "network" });
  const circular = { message: "secret" }; circular.cause = circular;
  expect(companionFailureDiagnostics(circular)).toBeUndefined();
});
