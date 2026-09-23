# Tasks: [FEATURE NAME]

**Input**: Design documents from `/.spek/specs/[NNN-slug]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)
**Tests**: the examples below include test tasks. Tests are OPTIONAL -- include only if
explicitly requested in the feature specification.
**Organization**: tasks are grouped by user story to allow independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- Adjust based on the structure defined in `plan.md`

## Phase 1: Setup

- [ ] T001 [Initial project setup/required dependencies]

## Phase 2: Foundational (blocks all user stories)

- [ ] T002 [Blocking shared infrastructure]

## Phase 3: User Story 1 (Priority: P1) 🎯 MVP

**Goal**: [What this story delivers in isolation]
**Independent Test**: [How to validate this story on its own]

- [ ] T003 [P] [US1] [Task with exact file path]
- [ ] T004 [US1] [Task that depends on T003]

**Checkpoint**: US1 should be complete and independently testable at this point.

## Phase 4: User Story 2 (Priority: P2)

**Goal**: [What this story delivers in isolation]
**Independent Test**: [How to validate this story on its own]

- [ ] T005 [P] [US2] [Task with exact file path]

**Checkpoint**: US2 should be complete and independently testable, without breaking US1.

## Phase N: Polish

- [ ] T0NN [Cross-cutting refinement: documentation, cleanup, optimization]

## Dependencies & Execution Order

- Setup (Phase 1) blocks everything.
- Foundational (Phase 2) blocks all user stories.
- Each User Story can be implemented and delivered independently after Foundational.
- Tasks marked [P] within the same phase can be dispatched in parallel (different agents,
  different files).
