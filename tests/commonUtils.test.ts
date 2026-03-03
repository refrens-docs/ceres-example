import {
    decodeBase64,
    toCssColor,
    mergeInto,
    isPlainObject,
} from "../src/main/commonUtils";

describe("commonUtils", () => {
    describe("decodeBase64", () => {
        it("returns null for empty input", () => {
            expect(decodeBase64(null)).toBeNull();
            expect(decodeBase64("")).toBeNull();
        });

        it("decodes valid base64 strings", () => {
            expect(decodeBase64("SGVsbG8=")).toBe("Hello");
        });

        it("returns null for invalid base64 strings", () => {
            expect(decodeBase64("NotBase64!!")).toBeNull();
        });
    });

    describe("toCssColor", () => {
        it("returns valid css color string", () => {
            expect(toCssColor({ r: 255, g: 0, b: 0 })).toBe("rgb(255, 0, 0)");
            expect(toCssColor({ r: 0, g: 0, b: 0, a: 0.5 })).toBe("rgba(0, 0, 0, 0.5)");
        });

        it("returns null for invalid input", () => {
            expect(toCssColor(null)).toBeNull();
            expect(toCssColor("invalid")).toBe("invalid"); // It returns string if input is string
        });
    });

    describe("mergeInto", () => {
        it("merges two plain objects", () => {
            const target = { a: 1 };
            const source = { b: 2 };
            const result = mergeInto(target, source);
            expect(result).toEqual({ a: 1, b: 2 });
        });

        it("deep merges objects", () => {
            const target = { a: { x: 1 } };
            const source = { a: { y: 2 } };
            const result = mergeInto(target, source);
            expect(result).toEqual({ a: { x: 1, y: 2 } });
        });

        it("overwrites arrays (does not merge them)", () => {
            const target = { a: [1, 2] };
            const source = { a: [3, 4] };
            const result = mergeInto(target, source);
            expect(result).toEqual({ a: [3, 4] });
        });
    });

    describe("isPlainObject", () => {
        it("returns true for plain objects", () => {
            expect(isPlainObject({})).toBe(true);
            expect(isPlainObject({ a: 1 })).toBe(true);
        });

        it("returns false for non-objects or null", () => {
            expect(isPlainObject(null)).toBe(false);
            expect(isPlainObject([])).toBe(false);
            expect(isPlainObject("string")).toBe(false);
            expect(isPlainObject(123)).toBe(false);
        });
    });
});
