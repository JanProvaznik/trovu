import { TrovuService } from "./trovu-service.js";

describe("TrovuService", () => {
  let service: TrovuService;

  beforeAll(() => {
    service = new TrovuService();
  });

  describe("searchShortcuts", () => {
    it("should find shortcuts matching keyword", async () => {
      const results = await service.searchShortcuts("google", "en", "us", 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("keyword");
      expect(results[0]).toHaveProperty("namespace");
    });

    it("should respect the limit parameter", async () => {
      const results = await service.searchShortcuts("g", "en", "us", 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("should filter by tag", async () => {
      const results = await service.searchShortcuts("tag:maps", "en", "us", 10);
      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.tags).toContain("maps");
      });
    });

    it("should return empty array for non-matching query", async () => {
      const results = await service.searchShortcuts(
        "xyznonexistent12345",
        "en",
        "us",
        10
      );
      expect(results).toEqual([]);
    });
  });

  describe("getRedirectUrl", () => {
    it("should return redirect URL for Google search", async () => {
      const result = await service.getRedirectUrl("g berlin", "en", "us");
      expect(result.status).toBe("found");
      expect(result.redirectUrl).toContain("google.com");
      expect(result.redirectUrl).toContain("berlin");
    });

    it("should return redirect URL for Wikipedia", async () => {
      const result = await service.getRedirectUrl("w berlin", "en", "us");
      expect(result.status).toBe("found");
      expect(result.redirectUrl).toContain("wikipedia.org");
      expect(result.redirectUrl).toContain("berlin");
    });

    it("should handle language variable replacement", async () => {
      const result = await service.getRedirectUrl("w berlin", "de", "de");
      expect(result.status).toBe("found");
      expect(result.redirectUrl).toContain("de.wikipedia.org");
    });

    it("should return not_found for unknown shortcuts", async () => {
      const result = await service.getRedirectUrl(
        "xyznonexistent test",
        "en",
        "us"
      );
      expect(result.status).toBe("not_found");
    });

    it("should handle shortcuts with multiple arguments", async () => {
      const result = await service.getRedirectUrl(
        "gd berlin, munich",
        "en",
        "us"
      );
      expect(result.status).toBe("found");
      expect(result.redirectUrl).toContain("maps");
    });

    it("should handle homepage shortcuts (0 arguments)", async () => {
      const result = await service.getRedirectUrl("g", "en", "us");
      expect(result.status).toBe("found");
      expect(result.redirectUrl).toContain("google.com");
    });
  });

  describe("listNamespaces", () => {
    it("should list available namespaces", async () => {
      const namespaces = await service.listNamespaces("en", "us");
      expect(namespaces.length).toBeGreaterThan(0);

      const names = namespaces.map((ns) => ns.name);
      expect(names).toContain("o");
      expect(names).toContain("en");
      expect(names).toContain(".us");
    });

    it("should include shortcut counts", async () => {
      const namespaces = await service.listNamespaces("en", "us");
      namespaces.forEach((ns) => {
        expect(ns.shortcutCount).toBeGreaterThan(0);
      });
    });

    it("should categorize namespace types", async () => {
      const namespaces = await service.listNamespaces("en", "us");

      const oNamespace = namespaces.find((ns) => ns.name === "o");
      expect(oNamespace?.type).toBe("special");

      const enNamespace = namespaces.find((ns) => ns.name === "en");
      expect(enNamespace?.type).toBe("language");

      const usNamespace = namespaces.find((ns) => ns.name === ".us");
      expect(usNamespace?.type).toBe("country");
    });

    it("should respect language parameter", async () => {
      const namespaces = await service.listNamespaces("de", "de");
      const names = namespaces.map((ns) => ns.name);
      expect(names).toContain("de");
      expect(names).toContain(".de");
    });
  });

  describe("getShortcutDetails", () => {
    it("should return details for existing shortcut", async () => {
      const details = await service.getShortcutDetails("g", 1, "en", "us");
      expect(details.found).toBe(true);
      expect(details.keyword).toBe("g");
      expect(details.argumentCount).toBe(1);
      expect(details.title).toBe("Google.com");
      expect(details.url).toContain("google.com");
    });

    it("should include examples when available", async () => {
      const details = await service.getShortcutDetails("g", 1, "en", "us");
      expect(details.examples).toBeDefined();
      expect(details.examples!.length).toBeGreaterThan(0);
    });

    it("should return found=false for non-existent shortcut", async () => {
      const details = await service.getShortcutDetails(
        "xyznonexistent",
        1,
        "en",
        "us"
      );
      expect(details.found).toBe(false);
    });

    it("should filter by namespace when provided", async () => {
      const details = await service.getShortcutDetails("g", 1, "en", "us", "o");
      expect(details.found).toBe(true);
      expect(details.namespace).toBe("o");
    });

    it("should return different results for different argument counts", async () => {
      const details0 = await service.getShortcutDetails("g", 0, "en", "us");
      const details1 = await service.getShortcutDetails("g", 1, "en", "us");

      expect(details0.found).toBe(true);
      expect(details1.found).toBe(true);
      expect(details0.url).not.toBe(details1.url);
    });
  });
});
