import { describe, expect, it } from "vitest";
import {
  liveConfirmPasswordError,
  livePasswordLengthError,
  passwordsMeetConfirm,
  patchLivePasswordPair,
  submitConfirmPasswordError,
  submitPasswordLengthError,
} from "./passwordValidation";

describe("passwordValidation", () => {
  it("clears the length error once the password has 8+ characters", () => {
    expect(livePasswordLengthError("121323")).toBe("At least 8 characters");
    expect(livePasswordLengthError("121323678899")).toBeUndefined();
    expect(livePasswordLengthError("")).toBeUndefined();
  });

  it("does not treat matching values as a mismatch, even when still too short", () => {
    expect(liveConfirmPasswordError("121323", "121323")).toBeUndefined();
    expect(liveConfirmPasswordError("121323", "121324")).toBe("Passwords don't match");
    expect(liveConfirmPasswordError("secret12", "")).toBeUndefined();
  });

  it("requires confirm on submit and still checks equality", () => {
    expect(submitPasswordLengthError("121323")).toBe("At least 8 characters");
    expect(submitConfirmPasswordError("secret12", "")).toBe("Please confirm your password");
    expect(submitConfirmPasswordError("secret12", "secret12")).toBeUndefined();
    expect(submitConfirmPasswordError("secret12", "other")).toBe("Passwords don't match");
  });

  it("only celebrates a match when the password also meets length", () => {
    expect(passwordsMeetConfirm("121323", "121323")).toBe(false);
    expect(passwordsMeetConfirm("secret12", "secret12")).toBe(true);
  });

  it("patches pair errors without wiping other fields", () => {
    const prev = { email: "Valid email required", password: "At least 8 characters" };
    const afterLength = patchLivePasswordPair(prev, "121323678899", "121323678899", {
      password: "password",
      confirm: "confirmPassword",
    });
    expect(afterLength.email).toBe("Valid email required");
    expect(afterLength.password).toBeUndefined();
    expect(afterLength.confirmPassword).toBeUndefined();

    const afterMismatch = patchLivePasswordPair(afterLength, "secret12", "secret99", {
      password: "password",
      confirm: "confirmPassword",
    });
    expect(afterMismatch.confirmPassword).toBe("Passwords don't match");
    expect(afterMismatch.password).toBeUndefined();
  });
});
