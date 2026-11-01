<!-- dr-ai-version: 3.8.1 -->
# Database Queries

- ALWAYS review table names and column names against the migrations, the generated types, or the live schema before writing a query
- When queries involve one or more JOINs, ALWAYS create a database view instead of writing complex queries inline.
- When fetching a large volume of data that does not need to be fully up to date, consider a materialized view or a similar precomputed resource (summary table, cache) instead of querying the base tables every time.
- NEVER build queries by concatenating or interpolating user input; always use parameterized queries or the ORM/query builder.
- NEVER run destructive statements (DROP, TRUNCATE, DELETE or UPDATE without WHERE) without explicit user confirmation.
- NEVER run write statements against a production database; ask the user which environment is targeted when it is not explicit.
- When the project uses row-level security, every new table must ship with its policies in the same migration.
- NEVER use `SELECT *`; list only the columns the caller needs.
- Always paginate or limit queries that can return an unbounded number of rows.
- Avoid N+1: never run a query inside a loop; fetch in batch or with a join.
- Wrap multi-statement writes that must succeed or fail together in a single transaction.
- Run EXPLAIN on new or changed queries over large tables before considering them done.
