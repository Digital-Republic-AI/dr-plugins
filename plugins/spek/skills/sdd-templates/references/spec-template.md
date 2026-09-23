# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[NNN-feature-slug]`
**Created**: [DATE]
**Status**: Draft
**Input**: Original user description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - [Short Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Short Title] (Priority: P2)

[Repeat the structure above for each additional user story]

---

### Edge Cases

- What happens when [boundary condition]?
- How does the system handle [error scenario]?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST [specific capability]
- **FR-002**: The system MUST [specific capability]
- **FR-003**: Users MUST be able to [key interaction]

- **FR-00X**: The system MUST [still-ambiguous aspect] `[NEEDS CLARIFICATION: specific question]`

### Key Entities *(include if the feature involves data)*

- **[Entity 1]**: [What it represents, key attributes, no implementation details]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Scope Boundaries *(mandatory)*

### What Changes

- [Behavior or area this feature modifies or adds]
- [Behavior or area this feature modifies or adds]

### What Must Be Preserved

<!--
Each entry is a VERIFICATION CRITERION, not a statement of intent: /spek:verify checks every
PR-00X with concrete evidence (file:line or test output), exactly as it does for FR and SC.
Write only entries that are objectively checkable -- if it cannot be confirmed by inspecting
code or running a command, rewrite it until it can.
-->

- **PR-001**: [Existing behavior that MUST remain intact, stated so it can be objectively checked]
- **PR-002**: [Existing behavior that MUST remain intact, stated so it can be objectively checked]

### Out of Scope

- [Thing deliberately not addressed by this feature]
- [Thing deliberately not addressed by this feature]

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g.: "users complete sign-up in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g.: "system supports 1000 concurrent users without degradation"]

## Assumptions

- [Assumption about target users]
- [Assumption about scope boundaries]
- [Dependency on an existing system/service]

## Clarifications

*Filled in incrementally by /spek:clarify. Do not edit this section manually.*
