/**
 * WorkspaceStateService
 *
 * Safe wrapper around VS Code workspaceState with:
 * - JSON safety
 * - corruption protection
 * - default values
 */

export class WorkspaceStateService {
    private state: any;

    constructor(context: { workspaceState: any }) {
        this.state = context.workspaceState;
    }

    /**
     * Save value
     */
    async set<T>(key: string, value: T): Promise<void> {
        const serialized = JSON.stringify(value);
        await this.state.update(key, serialized);
    }

    /**
     * Retrieve value safely
     */
    get<T>(key: string, defaultValue?: T): T | undefined {
        const raw = this.state.get(key);

        if (raw === undefined) {
            return defaultValue;
        }

        try {
            return JSON.parse(raw) as T;
        } catch {
            // corrupted data protection
            return defaultValue;
        }
    }

    /**
     * Delete value
     */
    async delete(key: string): Promise<void> {
        await this.state.update(key, undefined);
    }
}
