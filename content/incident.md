# Incident: A distributed lock that doesnt work

## Introduction

```mermaid
%% caption: Diagram: the same daily job running in several regions at 00:00 UTC, all reaching for one lock row in the shared task database.
flowchart LR
  A["Region A<br/>@Scheduled 00:00 UTC"] --> L
  B["Region B<br/>@Scheduled 00:00 UTC"] --> L
  C["Region C<br/>@Scheduled 00:00 UTC"] --> L
  L[("Lock table")]
```

One of our daily jobs ran in several regions at once, and a lock was supposed to make sure that only one of them did the work. Occasionally, it didn't. This is the description of what was happenening.

**Note: everything below is severely simplified pseudocode, written to show the idea rather than the real implementation.**

## Context

The pool of statements has to be processed every day at 00:00 UTC. In some cases the whole run needs to finish within a minute. Each region has the same Spring `@Scheduled` job, set to the same nominal time, so the only thing preventing them from all doing the same work is the lock.

### How the lock worked

```mermaid
%% caption: Diagram: the lock row's flag moving from false to true when a caller takes it, then back to false when the task finishes.
stateDiagram-v2
  Free: flag = false
  Locked: flag = true
  [*] --> Free
  Free --> Locked: a caller takes the lock and submits the tasks
  Locked --> Locked: other callers see the flag and do nothing
  Locked --> Free: task submission finishes and the flag is released
```

The lock itself follows a simple distributed lock design, the lock lives in a separate database, with one row for each recurring job:

| lock_id | name | flag | status    | ... |
|---|---|------|-----------|-----|
| 123 | statement process | true | submitted | ... |

```java
void getLockAndProcess(lockId, taskFunc) {
    lock = query(lockId);
    if (!lock.flag) {
        obtainLock()   // sets flag to true
        taskFunc();
        releaseLock    // sets flag to false
    }
}
```

The intention is that if several callers fire the same task at the same moment, only one of them gets through, and the flag is released when the work is done.

### How it was used

```java
@Scheduled(00:00 UTC)
void processAllTasks() {
    getLockAndProcess(lockId, this::submitTasks);
}

void submitTasks() {
    for (id : statementIds)                  // unique ids, so unique statements
        submitAsync(processStatement(id));   // submit statement process async task
}

# when statement is being processed, a query and insert would be done.
void insertStatement(statement) {
    if (query(statement.id) doesnt exist)
        insert(statement);
    else
        throw DuplicateStatementError;   // shouldn't happen: one machine owns the pool
}
```

The `else` branch in `insertStatement` rests on an assumption. Since only one machine is supposed to touch the pool, finding a statement that already exists would mean something had gone seriously wrong, so the code treats it as an error.

## What went wrong

At some point we began to see exactly those duplicate-statement errors. It indicated that statements were being inserted twice, which meant the lock was failing somewhere.

### Root cause

The distributed lock had been designed with long-running tasks in mind. Our job was a different case since all we needed was to submit the tasks for further processing. The whole thing was frequently processed in under a second, which led to the following sequence as seen relative to the lock database:

```mermaid
%% caption: Sequence diagram: Region A takes the lock, processes the pool and releases it before Region B, a moment later, finds the flag clear and takes it again. Both then process the same pool at the same time.
sequenceDiagram
  participant A as Region A
  participant DB as Lock DB
  participant B as Region B
  A->>DB: 00:00:00 read flag
  DB-->>A: false
  A->>DB: set flag = true
  Note over A: submits the whole pool in under a second
  A->>DB: set flag = false
  Note over B: its 00:00:00 arrives slightly later
  B->>DB: read flag
  DB-->>B: false
  B->>DB: set flag = true
  Note over B: submits the same pool
  B->>DB: set flag = false
  activate A
  activate B
  A->>A: process task 1
  B->>B: process task 1
  A->>A: process task 2
  B->>B: process task 2
  Note over A,B: same tasks processed twice
  deactivate A
  deactivate B
```

1. Region A reaches its own 00:00:00 UTC and takes the lock.
2. Region A submits the entire pool and releases the lock.
3. Region B reaches its own 00:00:00 UTC slightly later. Small differences between the machines' clocks, the timing of the scheduler and the physical distance between regions all add up, so a delay of a second or milliseconds is quite plausible. By then, the flag is clear again.
4. Region B takes the lock, submits the same pool and releases the lock.
5. Region A & B now are processing the same pool asynchronously

And sometimes both regions happen to process the same task, and performs `insertStatement` to the same statement database. This would also cause
insert race conditions.

```mermaid
%% caption: Diagram: two concurrent callers both see that the statement does not exist, then both insert it.
sequenceDiagram
  participant X as Caller 1
  participant DB as Statements table
  participant Y as Caller 2
  X->>DB: exists(id)?
  Y->>DB: exists(id)?
  DB-->>X: no
  DB-->>Y: no
  X->>DB: insert
  Y->>DB: insert
  Note over DB: the same statement is inserted twice
```

The DB then handles the duplicate insert gracefully by throwing a SQLIntegrityConstraintViolationException. 

## The fix

### What I proposed

```mermaid
%% caption: Diagram: a central scheduler microservice splitting the pool into parts and handing each to a different machine, by region or by load.
flowchart TD
  S["Scheduler microservice<br/>triggers at 00:00 UTC"] --> P["Statement pool"]
  P --> P1["Part 1"] --> M1["Machine 1"]
  P --> P2["Part 2"] --> M2["Machine 2"]
  P --> P3["Part 3"] --> M3["Machine 3"]
```

The cleaner solution, in my view, was to remove the lock entirely, along with the dependence on each machine's own clock. Instead we rely on a scheduler microservice, a dedicated central service whose job is to trigger and coordinate background and cron tasks across other services, and it seemed the natural thing to have it hand out the work at 00:00 UTC. Because it would only ever distribute a single pool, there would be no opportunity for duplicates. It would also give us a sensible route to larger pools, since the service could divide the pool into smaller parts and give each to a different machine, either by region or according to load.

### What I shipped in the meantime

```mermaid
%% caption: Diagram: old flow (check, then insert) next to the new flow (insert, catch the constraint violation, compare fields, warn).
flowchart LR
  subgraph After
    N1["insert"] -->|ok| N2["done"]
    N1 -->|constraint violation| N3["query existing row"]
    N3 --> N4{"check details match"}
    N4 -->|match| N5["warn DuplicateStatement"]
    N4 -->|details differ| N6["throw error"]
  end
  subgraph Before
    O1{"exists?"} -->|no| O2["insert"]
    O1 -->|yes| O3["throw DuplicateStatementError"]
  end
```

The proposal was a fairly large change, and it wasn't something I could finish properly within my placement since my contract was ending. Hence, I described it in the system-analysis document and provided a temporary solution.
First I simply stopped the duplicates from throwing errors as it wasnt having any real business impact. I then adopted a insert first design for when the optimal solution would be implemented.

```java
void insertStatement(statement) {
    try {
        insert(statement);                       // insert first
    } catch (SQLIntegrityConstraintViolationException e) {
        existing = query(statement.id);
        checkDetailsMatch(statement, existing);  // e.g. currency amounts
        warn(e);                                 // warning, not error
    }
}
```

There were a 2 reasons for use this, the pool itself was fairly small and the later solution would eliminate duplicates. Here are the comparisons between the two:

| Approach | When to use | Reason                                                                                                                        |
|---|---|-------------------------------------------------------------------------------------------------------------------------------|
| Insert first | The probability of duplicates is very small | Almost every insert is required, so the lookup query should be used rarely.                                                   |
| Query, then insert | The probability of duplicates is high | Duplicates can be mostly caught with a fast query (on an indexed database), so they are eliminated cheaply before the insert. |

Whichever approach is used, remember that neither one makes the operation idempotent on its own. The database must have a unique key constraint configured, because that constraint is what actually guarantees duplicates cannot get in.

## Testing

```mermaid
%% caption: Screenshot or diagram: dev-environment instances started in several regions, all scheduled for the next upcoming minute.
flowchart LR
  T["Scheduled time set to the next upcoming minute"] --> R1["Dev instance: region 1"]
  T --> R2["Dev instance: region 2"]
  T --> R3["Dev instance: region 3"]
  R1 --> DB[("Dev lock database")]
  R2 --> DB
  R3 --> DB
  DB --> O["Race reproduced, new code copes"]
```

Alongside the usual unit tests or integration tests etc, I wanted to see the problem happen for real, so I recreated it in the dev environment. I started instances in several different regions and set the scheduled time to the next upcoming minute, so that they would all fire together. That reproduced the multi-region race well enough, and I could watch the new code cope with it.

## Release

```mermaid
%% caption: Diagram: grey-scale rollout from 1% to 5% and on to 100% of production, with the runtime config flag able to switch between old and new behaviour.
flowchart LR
  A["1%"] --> B["5%"] --> C["…"] --> D["100%"]
  F{{"Runtime config flag"}} -.->|"switch old / new behaviour without a deployment"| A
```

The release followed our normal process, with a safety net. We used a grey-scale rollout, pushing the change to 1% of production, then 5%, and on up to 100%, reading the logs carefully at every step. The split can be made in various ways, for instance by region, by user ID or by transaction amount starting with the smallest, but the point is the same in each case: a change should never reach everyone at once, as happened in the CrowdStrike incident.

The new code also sat behind a configuration flag that the machines read at runtime, so the choice between the old and new behaviour could be made without a deployment. Had something gone wrong, we would have switched the flag back rather than rolling the code back, because a rollback can take long enough to cause an outage of its own. Once the change had proven itself, the flag would be removed.

## Outcome

The temporary change was small and the rollout was uneventful. The only difference anyone noticed was the duplicate warnings we had expected, which have no business impact. 

## What I took from it

The lesson I keep returning to is an old one: use the right tool for the right job. A distributed lock suits services that constantly transact on shared data, and long-running tasks where a late caller finds the flag still set and goes away. Our job was neither. It ran once a day, with a single pool of tasks to hand out, so there was nothing to share and nothing to take turns over. A lock only approximates "hand it out once", because it releases as soon as the work is done, and once the job finished in under a second, it was released before the slower region had even arrived.

The other thing that stayed with me was how hard a timing bug is to debug. Nothing was broken in the usual sense: the code did exactly what it said, and it failed only when a few seconds of drift between regions lined up with a fast job. It appeared now and then, seemingly at random, and vanished when I went looking for it. There was no stack trace, only a duplicate error, several steps removed from the real cause.

I hope no one else has to chase a bug like this one.
