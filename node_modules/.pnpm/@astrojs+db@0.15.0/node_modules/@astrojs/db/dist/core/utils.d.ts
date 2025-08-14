import { type ManagedAppToken } from '@astrojs/studio';
import type { AstroConfig, AstroIntegration } from 'astro';
import './types.js';
export type VitePlugin = Required<AstroConfig['vite']>['plugins'][number];
export declare function getAstroEnv(envMode?: string): Record<`ASTRO_${string}`, string>;
export type RemoteDatabaseInfo = {
    type: 'libsql' | 'studio';
    url: string;
};
export declare function getRemoteDatabaseInfo(): RemoteDatabaseInfo;
export declare function getManagedRemoteToken(token?: string, dbInfo?: RemoteDatabaseInfo): Promise<ManagedAppToken>;
export declare function getDbDirectoryUrl(root: URL | string): URL;
export declare function defineDbIntegration(integration: AstroIntegration): AstroIntegration;
export type Result<T> = {
    success: true;
    data: T;
} | {
    success: false;
    data: unknown;
};
/**
 * Map an object's values to a new set of values
 * while preserving types.
 */
export declare function mapObject<T, U = T>(item: Record<string, T>, callback: (key: string, value: T) => U): Record<string, U>;
