/**
 * Storage Version Manager
 *
 * A versioned local storage system with automatic migrations.
 *
 * Usage:
 * 1. Define your schema with migrations:
 *    const schema = StorageVersionManager.defineSchema('myApp', {
 *      version: 2,
 *      default: { items: [], settings: {} },
 *      migrations: {
 *        1: (data) => ({ ...data, items: data.oldItems || [] }),  // v0 -> v1
 *        2: (data) => ({ ...data, settings: { theme: 'light' } }) // v1 -> v2
 *      }
 *    });
 *
 * 2. Load data (auto-migrates if needed):
 *    const data = StorageVersionManager.load(schema);
 *
 * 3. Save data:
 *    StorageVersionManager.save(schema, data);
 */

const StorageVersionManager = (function() {
    'use strict';

    const METADATA_SUFFIX = '__meta';

    /**
     * Define a schema for versioned storage
     * @param {string} key - The localStorage key
     * @param {Object} config - Schema configuration
     * @param {number} config.version - Current schema version (positive integer)
     * @param {*} config.default - Default value for new/empty storage
     * @param {Object} config.migrations - Object mapping version numbers to migration functions
     * @returns {Object} Schema object
     */
    function defineSchema(key, config) {
        if (!key || typeof key !== 'string') {
            throw new Error('Schema key must be a non-empty string');
        }
        if (!Number.isInteger(config.version) || config.version < 1) {
            throw new Error('Schema version must be a positive integer');
        }

        return {
            key: key,
            version: config.version,
            default: config.default,
            migrations: config.migrations || {},
            // Validate migrations cover all versions
            _validateMigrations: function() {
                for (let v = 1; v <= this.version; v++) {
                    if (!this.migrations[v]) {
                        console.warn(`StorageVersionManager: Missing migration for version ${v} in schema "${key}". This is okay if no migration is needed for this version.`);
                    }
                }
            }
        };
    }

    /**
     * Get metadata for a storage key
     * @param {string} key - The localStorage key
     * @returns {Object|null} Metadata object or null if not found
     */
    function getMetadata(key) {
        try {
            const metaStr = localStorage.getItem(key + METADATA_SUFFIX);
            if (metaStr) {
                return JSON.parse(metaStr);
            }
        } catch (e) {
            console.error('StorageVersionManager: Error reading metadata:', e);
        }
        return null;
    }

    /**
     * Set metadata for a storage key
     * @param {string} key - The localStorage key
     * @param {Object} metadata - Metadata to store
     */
    function setMetadata(key, metadata) {
        try {
            localStorage.setItem(key + METADATA_SUFFIX, JSON.stringify(metadata));
        } catch (e) {
            console.error('StorageVersionManager: Error saving metadata:', e);
        }
    }

    /**
     * Run migrations from one version to another
     * @param {Object} schema - The schema object
     * @param {*} data - Current data
     * @param {number} fromVersion - Starting version (0 for unversioned/legacy data)
     * @returns {*} Migrated data
     */
    function runMigrations(schema, data, fromVersion) {
        let currentData = data;

        for (let v = fromVersion + 1; v <= schema.version; v++) {
            const migration = schema.migrations[v];
            if (migration) {
                try {
                    console.log(`StorageVersionManager: Running migration v${v-1} -> v${v} for "${schema.key}"`);
                    currentData = migration(currentData);
                } catch (e) {
                    console.error(`StorageVersionManager: Migration to v${v} failed:`, e);
                    throw new Error(`Migration to version ${v} failed: ${e.message}`);
                }
            }
        }

        return currentData;
    }

    /**
     * Load data from localStorage with automatic migration
     * @param {Object} schema - The schema object from defineSchema
     * @param {Object} options - Load options
     * @param {boolean} options.skipMigration - If true, don't run migrations (useful for debugging)
     * @returns {*} The loaded (and possibly migrated) data, or the default value
     */
    function load(schema, options = {}) {
        try {
            const rawData = localStorage.getItem(schema.key);

            if (rawData === null) {
                // No data exists, return default
                return deepClone(schema.default);
            }

            let data;
            try {
                data = JSON.parse(rawData);
            } catch (e) {
                console.error('StorageVersionManager: Failed to parse stored data, returning default:', e);
                return deepClone(schema.default);
            }

            // Check version
            const metadata = getMetadata(schema.key);
            const storedVersion = metadata?.version || 0; // 0 = legacy unversioned data

            if (storedVersion === schema.version) {
                // Current version, no migration needed
                return data;
            }

            if (storedVersion > schema.version) {
                // Future version - data was created by a newer version of the app
                console.warn(`StorageVersionManager: Data version (${storedVersion}) is newer than schema version (${schema.version}). This may cause issues.`);
                return data;
            }

            // Need to migrate
            if (options.skipMigration) {
                return data;
            }

            const migratedData = runMigrations(schema, data, storedVersion);

            // Save migrated data
            save(schema, migratedData);

            return migratedData;
        } catch (e) {
            console.error('StorageVersionManager: Error loading data:', e);
            return deepClone(schema.default);
        }
    }

    /**
     * Save data to localStorage with version metadata
     * @param {Object} schema - The schema object from defineSchema
     * @param {*} data - The data to save
     */
    function save(schema, data) {
        try {
            localStorage.setItem(schema.key, JSON.stringify(data));
            setMetadata(schema.key, {
                version: schema.version,
                savedAt: new Date().toISOString()
            });
        } catch (e) {
            console.error('StorageVersionManager: Error saving data:', e);
            throw e;
        }
    }

    /**
     * Remove data and metadata from localStorage
     * @param {Object} schema - The schema object from defineSchema
     */
    function remove(schema) {
        try {
            localStorage.removeItem(schema.key);
            localStorage.removeItem(schema.key + METADATA_SUFFIX);
        } catch (e) {
            console.error('StorageVersionManager: Error removing data:', e);
        }
    }

    /**
     * Check if data exists in localStorage
     * @param {Object} schema - The schema object from defineSchema
     * @returns {boolean} True if data exists
     */
    function exists(schema) {
        return localStorage.getItem(schema.key) !== null;
    }

    /**
     * Get the current stored version of data
     * @param {Object} schema - The schema object from defineSchema
     * @returns {number} The version number, or 0 if unversioned/no data
     */
    function getVersion(schema) {
        const metadata = getMetadata(schema.key);
        return metadata?.version || 0;
    }

    /**
     * Check if migration is needed
     * @param {Object} schema - The schema object from defineSchema
     * @returns {boolean} True if data needs migration
     */
    function needsMigration(schema) {
        if (!exists(schema)) return false;
        const storedVersion = getVersion(schema);
        return storedVersion < schema.version;
    }

    /**
     * Deep clone a value (simple implementation for JSON-serializable data)
     * @param {*} value - Value to clone
     * @returns {*} Cloned value
     */
    function deepClone(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    }

    /**
     * Export data for backup/debugging
     * @param {Object} schema - The schema object from defineSchema
     * @returns {Object} Object containing data and metadata
     */
    function exportData(schema) {
        return {
            key: schema.key,
            data: load(schema, { skipMigration: true }),
            metadata: getMetadata(schema.key),
            schemaVersion: schema.version
        };
    }

    /**
     * Import data (with optional migration)
     * @param {Object} schema - The schema object from defineSchema
     * @param {Object} exportedData - Data from exportData
     * @param {Object} options - Import options
     * @param {boolean} options.forceMigration - Run migrations even if versions match
     */
    function importData(schema, exportedData, options = {}) {
        const importedVersion = exportedData.metadata?.version || 0;
        let data = exportedData.data;

        if (importedVersion < schema.version || options.forceMigration) {
            data = runMigrations(schema, data, importedVersion);
        }

        save(schema, data);
    }

    // Public API
    return {
        defineSchema,
        load,
        save,
        remove,
        exists,
        getVersion,
        needsMigration,
        exportData,
        importData,
        // Expose for testing/debugging
        _getMetadata: getMetadata,
        _runMigrations: runMigrations
    };
})();

// Export for ES modules (if supported)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageVersionManager;
}
