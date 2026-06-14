import { describe, expect, it } from "vitest";

import { hello } from "./index.js";

describe("hello", () => {
  it("greets the given name", () => {
    // Arrange
    const name = "Hermes";

    // Act
    const greeting = hello(name);

    // Assert
    expect(greeting).toBe("hello, Hermes");
  });
});
