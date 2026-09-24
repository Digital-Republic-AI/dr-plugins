// c4-codebase:template
workspace "System Name" "Architecture discovered from repository evidence" {
    !identifiers hierarchical

    model {
        // Add people, software systems, containers, components, relationships and deployment environments.
        // Use stable camelCase identifiers and keep them unchanged across runs.
        // Uncertainty rule, applied to every element and relationship:
        //   high or confirmed: model it normally.
        //   medium: model it with the "Inferred" tag, for example "External,Inferred" or a relationship tagged "Inferred".
        //   low or uncertain: leave it out of this file; record it in CONCERNS.md and in the question ledger.
        // Tags: "External" for systems outside the boundary, "Database" for data stores, "Queue" for queues and topics.
    }

    views {
        // Add only views that answer a useful architecture question:
        // systemLandscape, systemContext, container, component, deployment, dynamic.

        styles {
            element "Person" {
                shape Person
            }
            element "Database" {
                shape Cylinder
            }
            element "Queue" {
                shape Pipe
            }
            element "External" {
                background #999999
                color #ffffff
            }
            element "Inferred" {
                border dashed
            }
            relationship "Relationship" {
                style solid
            }
            relationship "Inferred" {
                style dashed
            }
        }
    }
}
