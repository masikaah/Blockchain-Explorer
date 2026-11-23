import { check, defineContract, sql } from '@prisma/orm-postgres/contract-builder';

export const contract = defineContract(
  { naming: { tables: 'snake_case', columns: 'snake_case' } },
  ({ field, model, type }) => {

    // One row: where the tracker is and the running transaction total
    const ChainState = model('ChainState', {
      fields: {
        id: field.column(type.Int()).id().default(1),
        latestBlockNumber: field.column(type.BigInt()),
        latestBlockHash: field.column(type.Char(66)),
        trackingStartBlock: field.column(type.BigInt()),
        totalTxSinceStart: field.column(type.BigInt()).default(BigInt(0)),
        updatedAt: field.column(type.temporal.UpdatedAt()),
      },
    });

    // Recent block headers (pruned, see section 6)
    const BlockHeader = model('BlockHeader', {
      fields: {
        number: field.column(type.BigInt()).id(),
        hash: field.column(type.Char(66)).unique(),
        parentHash: field.column(type.Char(66)),
        timestamp: field.column(type.DateTime()),
        miner: field.column(type.Char(42)).optional(),
        sizeBytes: field.column(type.Int()).optional(),
        txCount: field.column(type.Int()),
      },
    });

    // Usage tracking to stay inside the Alchemy quota
    const ApiUsageDaily = model('ApiUsageDaily', {
      fields: {
        day: field.column(type.Date()),
        endpoint: field.column(type.String({ storage: 'varchar', length: 64 })),
        requests: field.column(type.BigInt()).default(BigInt(0)),
        cacheHits: field.column(type.BigInt()).default(BigInt(0)),
        alchemyCalls: field.column(type.BigInt()).default(BigInt(0)),
        alchemyCuEst: field.column(type.BigInt()).default(BigInt(0)),
      },
    });

    return {
      models: {
        ChainState: ChainState.sql({
          table: 'chain_state',
          checks: [check({ expression: sql`id = 1`, map: 'chain_state_single_row' })],
        }),

        BlockHeader: BlockHeader.sql(({ cols, constraints }) => ({
          table: 'block_headers',
          indexes: [
            constraints.index([cols.timestamp], { map: 'idx_block_headers_timestamp' }),
          ],
          checks: [
            check({ expression: sql`tx_count >= 0`, map: 'block_headers_tx_count_nonneg' }),
          ],
        })),

        ApiUsageDaily: ApiUsageDaily
          .attributes(({ fields, constraints }) => ({
            id: constraints.id([fields.day, fields.endpoint]),
          }))
          .sql({ table: 'api_usage_daily' }),
      },
    };
  },
);
