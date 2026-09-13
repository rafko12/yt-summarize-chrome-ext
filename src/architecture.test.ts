import fs from 'node:fs';
import path, { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('architektura i reguły zależności (src/architecture.test.ts)', () => {
  const projectRoot = resolve(__dirname, '..');
  const srcDir = resolve(__dirname);

  function getProductionSourceFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    entries.forEach((entry) => {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getProductionSourceFiles(fullPath));
      } else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        !entry.name.endsWith('.d.ts') &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.')
      ) {
        files.push(fullPath);
      }
    });

    return files;
  }

  function resolveImportPath(
    fromFile: string,
    importSpecifier: string
  ): string | null {
    let candidate = '';
    if (importSpecifier.startsWith('@/')) {
      candidate = resolve(srcDir, importSpecifier.slice(2));
    } else if (importSpecifier.startsWith('@assets/')) {
      candidate = resolve(srcDir, 'assets', importSpecifier.slice(8));
    } else if (importSpecifier.startsWith('.')) {
      candidate = resolve(path.dirname(fromFile), importSpecifier);
    } else {
      return null; // Zewnętrzny pakiet (np. z node_modules)
    }

    const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }

    const matchingExt = extensions.find((ext) => {
      const targetWithExt = candidate + ext;
      return (
        fs.existsSync(targetWithExt) && fs.statSync(targetWithExt).isFile()
      );
    });

    if (matchingExt) {
      return candidate + matchingExt;
    }

    return null;
  }

  it('automatycznie odkrywa produkcyjne moduły TS i TSX z pominięciem testów oraz deklaracji typów', () => {
    const prodFiles = getProductionSourceFiles(srcDir);
    expect(prodFiles.length).toBeGreaterThan(20);

    prodFiles.forEach((file) => {
      expect(file).not.toMatch(/\.test\.(ts|tsx)$/);
      expect(file).not.toMatch(/\.spec\.(ts|tsx)$/);
      expect(file).not.toMatch(/\.d\.ts$/);
    });
  });

  it('rozwiązuje importy względne oraz aliasy i potwierdza brak cykli w grafie modułów produkcyjnych', () => {
    const prodFiles = getProductionSourceFiles(srcDir);
    const graph = new Map<string, string[]>();

    prodFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const importMatches = Array.from(
        content.matchAll(
          /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g
        )
      );

      const dependencies: string[] = [];
      importMatches.forEach((match) => {
        const target = resolveImportPath(filePath, match[1]);
        if (
          target &&
          target.startsWith(srcDir) &&
          !target.includes('.test.') &&
          !target.includes('.spec.') &&
          !target.endsWith('.d.ts')
        ) {
          dependencies.push(target);
        }
      });

      graph.set(filePath, dependencies);
    });

    const visited = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited
    const cycles: string[] = [];

    function detectCycles(node: string, currentPath: string[]) {
      visited.set(node, 1);
      currentPath.push(node);

      const neighbors = graph.get(node) || [];
      neighbors.forEach((neighbor) => {
        const state = visited.get(neighbor) || 0;
        if (state === 1) {
          const cycleStart = currentPath.indexOf(neighbor);
          const fullCycleChain = currentPath
            .slice(cycleStart)
            .concat(neighbor)
            .map((p) => path.relative(projectRoot, p).replace(/\\/g, '/'))
            .join(' -> ');
          cycles.push(fullCycleChain);
        } else if (state === 0) {
          detectCycles(neighbor, currentPath);
        }
      });

      currentPath.pop();
      visited.set(node, 2);
    }

    prodFiles.forEach((file) => {
      if ((visited.get(file) || 0) === 0) {
        detectCycles(file, []);
      }
    });

    expect(
      cycles,
      `Wykryto cykle w grafie zależności:\n${cycles.join('\n')}`
    ).toEqual([]);
  });

  it('przestrzega reguły neutralności Reacta według ról modułów (widoki, hooki, punkty montowania)', () => {
    const prodFiles = getProductionSourceFiles(srcDir);

    prodFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const hasReactImport =
        /from\s+['"]react(-dom(\/client)?)?['"]/.test(content) ||
        /import\s+['"]react(-dom(\/client)?)?['"]/.test(content) ||
        content.includes("from 'react'") ||
        content.includes('from "react"') ||
        content.includes("from 'react-dom'") ||
        content.includes('from "react-dom"');

      if (hasReactImport) {
        const basename = path.basename(filePath);
        const isAllowedUiModule =
          basename.endsWith('.tsx') ||
          basename.startsWith('use') ||
          basename === 'index.tsx';

        expect(
          isAllowedUiModule,
          `Moduł ${path.relative(projectRoot, filePath).replace(/\\/g, '/')} importuje Reacta, ale nie jest widokiem (*.tsx), hookiem (use*.ts) ani punktem montowania (index.tsx)`
        ).toBe(true);
      }
    });
  });

  it('gwarantuje, że domena, storage, messaging, kontrakty i adaptery są całkowicie wolne od Reacta', () => {
    const prodFiles = getProductionSourceFiles(srcDir);

    const nonUiModules = prodFiles.filter((filePath) => {
      const relativePath = path.relative(srcDir, filePath).replace(/\\/g, '/');

      return (
        relativePath.startsWith('domain/') ||
        relativePath.startsWith('storage/') ||
        relativePath.startsWith('messaging/') ||
        relativePath.endsWith('/types.ts') ||
        relativePath === 'types.ts' ||
        relativePath.includes('Adapter') ||
        relativePath.includes('Contract') ||
        relativePath.startsWith('sidepanel/ai/providers/')
      );
    });

    expect(nonUiModules.length).toBeGreaterThan(10);

    nonUiModules.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

      expect(
        content.includes("from 'react'"),
        `Moduł ${relPath} nie może importować 'react'`
      ).toBe(false);
      expect(
        content.includes('from "react"'),
        `Moduł ${relPath} nie może importować "react"`
      ).toBe(false);
      expect(
        content.includes("from 'react-dom'"),
        `Moduł ${relPath} nie może importować 'react-dom'`
      ).toBe(false);
      expect(
        content.includes('from "react-dom"'),
        `Moduł ${relPath} nie może importować "react-dom"`
      ).toBe(false);
      expect(
        content.includes('React.'),
        `Moduł ${relPath} nie może odwoływać się do przestrzeni React.`
      ).toBe(false);
    });
  });
});
