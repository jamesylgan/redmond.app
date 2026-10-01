# Storage Version Manager

A versioned localStorage wrapper with automatic migrations for breaking schema changes.

## Quick Start

```javascript
// 1. Include the library
<script src="../lib/storage-version-manager.js"></script>

// 2. Define your schema
const mySchema = StorageVersionManager.defineSchema('myStorageKey', {
    version: 1,
    default: { items: [], settings: {} },
    migrations: {
        1: (data) => ({
            items: data.items || data.oldItems || [],
            settings: data.settings || {}
        })
    }
});

// 3. Load data (auto-migrates if needed)
let myData = StorageVersionManager.load(mySchema);

// 4. Save data
StorageVersionManager.save(mySchema, myData);
```

## API Reference

### `defineSchema(key, config)`

Creates a schema definition.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | The localStorage key |
| `config.version` | number | Current schema version (positive integer) |
| `config.default` | any | Default value for new/empty storage |
| `config.migrations` | object | Map of version numbers to migration functions |

### `load(schema, options?)`

Loads and auto-migrates data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | object | Schema from `defineSchema()` |
| `options.skipMigration` | boolean | Skip migration (for debugging) |

**Returns:** The data (migrated if needed), or the default value.

### `save(schema, data)`

Saves data with version metadata.

### `remove(schema)`

Removes data and metadata from localStorage.

### `exists(schema)`

Returns `true` if data exists.

### `getVersion(schema)`

Returns the stored version number (0 if unversioned/no data).

### `needsMigration(schema)`

Returns `true` if stored data needs migration.

### `exportData(schema)`

Returns an object with data, metadata, and schema version for backup.

### `importData(schema, exportedData, options?)`

Imports data with optional migration.

## How Migrations Work

1. When `load()` is called, it checks the stored version vs schema version
2. If stored version < schema version, it runs migrations sequentially
3. Each migration transforms data from version N-1 to version N
4. After migration, the new data is saved with the current version

```
Stored v0 → migration[1] → v1 → migration[2] → v2 → ... → current version
```

## Migration Best Practices

### DO:
- Always handle missing/undefined fields gracefully
- Preserve all existing data when adding new fields
- Test with real old data formats
- Document what each migration does

### DON'T:
- Modify existing migrations after release
- Skip version numbers
- Throw errors in migrations (return sensible defaults instead)
- Delete fields users might want to keep

## Storage Structure

For each key, the manager stores:
- `{key}` - The actual data (JSON)
- `{key}__meta` - Metadata with version and savedAt timestamp

## Adding to a New Tool

1. Include the library: `<script src="../lib/storage-version-manager.js"></script>`
2. Define your schema with version 1
3. Create a `STORAGE.md` in your tool's directory documenting the schema
4. Replace direct `localStorage` calls with `StorageVersionManager` methods

See `tools/spanish-tool/STORAGE.md` or `tools/payroll-checker/STORAGE.md` for examples.
