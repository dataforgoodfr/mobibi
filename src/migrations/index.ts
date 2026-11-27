import * as migration_20260911_125424 from './20260911_125424';
import * as migration_20261127_115253_campaigners from './20261127_115253_campaigners';

export const migrations = [
  {
    up: migration_20260911_125424.up,
    down: migration_20260911_125424.down,
    name: '20260911_125424',
  },
  {
    up: migration_20261127_115253_campaigners.up,
    down: migration_20261127_115253_campaigners.down,
    name: '20261127_115253_campaigners'
  },
];
