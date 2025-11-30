import fs from "fs";
import path from "path";
import jsyaml from "js-yaml";

interface ShortcutExample {
  arguments?: string;
  description: string;
  config?: Record<string, string>;
}

interface Shortcut {
  url?: string;
  title?: string;
  description?: string;
  tags?: string[];
  examples?: ShortcutExample[];
  include?: string | { key: string; namespace: string } | Array<{ key: string; namespace: string }>;
  deprecated?: { alternative: { query: string }; created: string };
  removed?: string;
  reachable?: boolean;
  namespace?: string;
  keyword?: string;
  argumentCount?: number;
}

interface NamespaceInfo {
  shortcuts: Record<string, Shortcut>;
  name: string;
}

interface ShortcutResult {
  keyword: string;
  argumentCount: number;
  namespace: string;
  title?: string;
  url?: string;
  description?: string;
  tags?: string[];
  reachable: boolean;
}

interface RedirectResult {
  status: string;
  redirectUrl?: string;
  alternative?: string;
  key?: string;
  namespace?: string;
}

interface NamespaceResult {
  name: string;
  shortcutCount: number;
  type: string;
}

interface ShortcutDetails {
  keyword: string;
  argumentCount: number;
  namespace: string;
  title?: string;
  url?: string;
  description?: string;
  tags?: string[];
  examples?: ShortcutExample[];
  reachable: boolean;
  found: boolean;
}

export class TrovuService {
  private data: {
    shortcuts: Record<string, Record<string, Shortcut>>;
    types: Record<string, Record<string, unknown>>;
  } | null = null;
  private config: { namespaces: string[]; language: string; country: string };

  constructor() {
    this.config = {
      namespaces: ["o", "<$language>", ".<$country>"],
      language: "en",
      country: "us",
    };
  }

  private async loadData(): Promise<void> {
    if (this.data) return;

    // Get the base directory - either from process.cwd() or relative to this file
    const possibleRoots = [
      process.cwd(),
      path.resolve(process.cwd(), "../.."), // When running from src/mcp
    ];

    // Try loading compiled data first
    for (const root of possibleRoots) {
      const compiledDataPath = path.resolve(root, "dist/public/data.json");
      if (fs.existsSync(compiledDataPath)) {
        const text = fs.readFileSync(compiledDataPath, "utf8");
        this.data = JSON.parse(text);
        return;
      }
    }

    // Fall back to loading YAML files directly
    for (const root of possibleRoots) {
      const dataPath = path.resolve(root, "data");
      if (fs.existsSync(dataPath)) {
        this.data = {
          shortcuts: this.loadYamlDirectory(
            path.join(dataPath, "shortcuts")
          ) as Record<string, Record<string, Shortcut>>,
          types: {
            city: this.loadYamlDirectory(path.join(dataPath, "types", "city")),
            date: this.loadYamlDirectory(path.join(dataPath, "types", "date")),
          },
        };
        return;
      }
    }

    throw new Error("Could not find Trovu data files");
  }

  private loadYamlDirectory(
    dirPath: string
  ): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};
    if (!fs.existsSync(dirPath)) return result;

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".yml"));
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf8");
      const data = jsyaml.load(content) as Record<string, unknown>;
      const namespace = file.replace(".yml", "");
      result[namespace] = data;
    }
    return result;
  }

  private getNamespaces(language: string, country: string): string[] {
    return this.config.namespaces.map((ns) =>
      ns
        .replace("<$language>", language)
        .replace("<$country>", country.toLowerCase())
    );
  }

  private buildNamespaceInfos(
    language: string,
    country: string
  ): Record<string, NamespaceInfo> {
    const namespaces = this.getNamespaces(language, country);
    const infos: Record<string, NamespaceInfo> = {};

    for (const ns of namespaces) {
      if (this.data?.shortcuts[ns]) {
        const shortcuts: Record<string, Shortcut> = {};
        for (const [key, shortcut] of Object.entries(
          this.data.shortcuts[ns]
        )) {
          const [keyword, argCount] = key.split(" ");
          shortcuts[key] = {
            ...shortcut,
            keyword,
            argumentCount: parseInt(argCount, 10),
            namespace: ns,
            reachable: true,
          };
        }
        infos[ns] = { shortcuts, name: ns };
      }
    }

    // Resolve includes
    for (const nsInfo of Object.values(infos)) {
      for (const shortcut of Object.values(nsInfo.shortcuts)) {
        this.resolveIncludes(shortcut, infos);
      }
    }

    return infos;
  }

  private resolveIncludes(
    shortcut: Shortcut,
    namespaceInfos: Record<string, NamespaceInfo>
  ): void {
    if (!shortcut.include) return;

    const includes = Array.isArray(shortcut.include)
      ? shortcut.include
      : [shortcut.include];

    for (const inc of includes) {
      let targetKey: string;
      let targetNamespace: string;

      if (typeof inc === "string") {
        targetKey = inc;
        targetNamespace = shortcut.namespace || "";
      } else {
        targetKey = inc.key;
        targetNamespace = inc.namespace;
      }

      const targetNsInfo = namespaceInfos[targetNamespace];
      if (!targetNsInfo) continue;

      const targetShortcut = targetNsInfo.shortcuts[targetKey];
      if (!targetShortcut) continue;

      // Merge properties (target provides defaults)
      if (!shortcut.url && targetShortcut.url) shortcut.url = targetShortcut.url;
      if (!shortcut.title && targetShortcut.title)
        shortcut.title = targetShortcut.title;
      if (!shortcut.description && targetShortcut.description)
        shortcut.description = targetShortcut.description;
      if (!shortcut.tags && targetShortcut.tags)
        shortcut.tags = targetShortcut.tags;
    }
  }

  async searchShortcuts(
    query: string,
    language: string,
    country: string,
    limit: number
  ): Promise<ShortcutResult[]> {
    await this.loadData();
    const namespaceInfos = this.buildNamespaceInfos(language, country);
    const results: ShortcutResult[] = [];

    // Parse filters from query
    const filters: { namespace?: string; tag?: string; url?: string } = {};
    const queryParts = query.split(" ");
    const remainingParts: string[] = [];

    for (const part of queryParts) {
      if (part.startsWith("ns:")) {
        filters.namespace = part.slice(3);
      } else if (part.startsWith("tag:")) {
        filters.tag = part.slice(4);
      } else if (part.startsWith("url:")) {
        filters.url = part.slice(4);
      } else {
        remainingParts.push(part);
      }
    }

    const searchQuery = remainingParts.join(" ").toLowerCase();

    for (const nsInfo of Object.values(namespaceInfos)) {
      if (filters.namespace && nsInfo.name !== filters.namespace) continue;

      for (const shortcut of Object.values(nsInfo.shortcuts)) {
        if (shortcut.deprecated || shortcut.removed) continue;

        if (filters.tag && !shortcut.tags?.includes(filters.tag)) continue;
        if (filters.url && !shortcut.url?.includes(filters.url)) continue;

        const matchesKeyword = shortcut.keyword
          ?.toLowerCase()
          .includes(searchQuery);
        const matchesTitle = shortcut.title
          ?.toLowerCase()
          .includes(searchQuery);
        const matchesTags = shortcut.tags?.some((t) =>
          t.toLowerCase().includes(searchQuery)
        );
        const matchesUrl = shortcut.url?.toLowerCase().includes(searchQuery);

        if (
          searchQuery === "" ||
          matchesKeyword ||
          matchesTitle ||
          matchesTags ||
          matchesUrl
        ) {
          results.push({
            keyword: shortcut.keyword || "",
            argumentCount: shortcut.argumentCount || 0,
            namespace: shortcut.namespace || "",
            title: shortcut.title,
            url: shortcut.url,
            description: shortcut.description,
            tags: shortcut.tags,
            reachable: shortcut.reachable || false,
          });

          if (results.length >= limit) break;
        }
      }
      if (results.length >= limit) break;
    }

    return results;
  }

  async getRedirectUrl(
    query: string,
    language: string,
    country: string
  ): Promise<RedirectResult> {
    await this.loadData();
    const namespaceInfos = this.buildNamespaceInfos(language, country);

    // Parse query
    const parts = query.trim().split(/\s+/);
    let keyword = parts[0]?.toLowerCase() || "";
    const argString = parts.slice(1).join(" ");
    const args = argString ? argString.split(",").map((a) => a.trim()) : [];

    // Check for extra namespace prefix (e.g., "de.g" or ".us.w")
    let extraNamespace: string | undefined;
    if (keyword.includes(".")) {
      const dotIndex = keyword.indexOf(".");
      extraNamespace = keyword.substring(0, dotIndex);
      keyword = keyword.substring(dotIndex + 1);

      // Handle country namespace (.xx format)
      if (extraNamespace === "") {
        const nextDotIndex = keyword.indexOf(".");
        if (nextDotIndex !== -1) {
          extraNamespace = "." + keyword.substring(0, nextDotIndex);
          keyword = keyword.substring(nextDotIndex + 1);
        } else {
          extraNamespace = "." + keyword;
          keyword = "";
        }
      }
    }

    // Find shortcut
    const shortcutKey = `${keyword} ${args.length}`;
    let shortcut: Shortcut | undefined;

    const namespacesToSearch = extraNamespace
      ? [extraNamespace]
      : Object.keys(namespaceInfos);

    for (const ns of namespacesToSearch) {
      const nsInfo = namespaceInfos[ns];
      if (!nsInfo) continue;

      if (nsInfo.shortcuts[shortcutKey]) {
        shortcut = nsInfo.shortcuts[shortcutKey];
        break;
      }
    }

    // Try with argumentString as single argument
    if (!shortcut && args.length > 1) {
      const singleArgKey = `${keyword} 1`;
      for (const ns of namespacesToSearch) {
        const nsInfo = namespaceInfos[ns];
        if (!nsInfo) continue;

        if (nsInfo.shortcuts[singleArgKey]) {
          shortcut = nsInfo.shortcuts[singleArgKey];
          args.splice(0, args.length, argString);
          break;
        }
      }
    }

    if (!shortcut) {
      return { status: "not_found" };
    }

    if (shortcut.deprecated) {
      let alternative = shortcut.deprecated.alternative.query;
      args.forEach((arg, i) => {
        alternative = alternative.replace(`<${i + 1}>`, arg);
      });
      return { status: "deprecated", alternative };
    }

    if (shortcut.removed) {
      return { status: "removed", key: shortcut.keyword };
    }

    if (!shortcut.url) {
      return { status: "not_found" };
    }

    // Replace placeholders in URL
    let redirectUrl = shortcut.url;
    redirectUrl = redirectUrl
      .replace(/<\$language>/g, language)
      .replace(/<\$country>/g, country);

    // Replace argument placeholders
    let argIndex = 0;
    redirectUrl = redirectUrl.replace(/<([^>]+)>/g, (match, placeholder) => {
      // Skip variable placeholders
      if (placeholder.startsWith("$")) return match;

      const arg = args[argIndex];
      argIndex++;

      if (arg === undefined) return match;

      // Handle type specifications
      const typeMatch = placeholder.match(/\{.*type:\s*(\w+)/);
      if (typeMatch) {
        // For now, just use the raw argument
        return encodeURIComponent(arg);
      }

      // Handle encoding specifications
      const encodingMatch = placeholder.match(/\{.*encoding:\s*(\w+)/);
      if (encodingMatch) {
        const encoding = encodingMatch[1];
        if (encoding === "none") return arg;
        if (encoding === "iso-8859-1") return escape(arg);
      }

      return encodeURIComponent(arg);
    });

    return { status: "found", redirectUrl };
  }

  async listNamespaces(
    language: string,
    country: string
  ): Promise<NamespaceResult[]> {
    await this.loadData();
    const namespaces = this.getNamespaces(language, country);
    const results: NamespaceResult[] = [];

    for (const ns of namespaces) {
      const shortcuts = this.data?.shortcuts[ns];
      if (shortcuts) {
        let type = "special";
        if (ns.startsWith(".")) type = "country";
        else if (ns.length === 2) type = "language";

        results.push({
          name: ns,
          shortcutCount: Object.keys(shortcuts).length,
          type,
        });
      }
    }

    return results;
  }

  async getShortcutDetails(
    keyword: string,
    argumentCount: number,
    language: string,
    country: string,
    namespace?: string
  ): Promise<ShortcutDetails> {
    await this.loadData();
    const namespaceInfos = this.buildNamespaceInfos(language, country);
    const shortcutKey = `${keyword} ${argumentCount}`;

    const namespacesToSearch = namespace
      ? [namespace]
      : Object.keys(namespaceInfos);

    for (const ns of namespacesToSearch) {
      const nsInfo = namespaceInfos[ns];
      if (!nsInfo) continue;

      const shortcut = nsInfo.shortcuts[shortcutKey];
      if (shortcut && !shortcut.deprecated && !shortcut.removed) {
        return {
          keyword: shortcut.keyword || keyword,
          argumentCount: shortcut.argumentCount || argumentCount,
          namespace: shortcut.namespace || ns,
          title: shortcut.title,
          url: shortcut.url,
          description: shortcut.description,
          tags: shortcut.tags,
          examples: shortcut.examples,
          reachable: shortcut.reachable || false,
          found: true,
        };
      }
    }

    return {
      keyword,
      argumentCount,
      namespace: namespace || "",
      reachable: false,
      found: false,
    };
  }
}
