workspace "Example Ordering System" "Example only: illustrates stable C4/Structurizr structure" {
    !identifiers hierarchical

    model {
        customer = person "Customer" "Places and tracks orders"

        ordering = softwareSystem "Ordering System" "Accepts and processes customer orders" {
            webApp = container "Web Application" "Customer-facing single-page application" "React"
            api = container "Orders API" "Handles order commands and queries" "Node.js, Express"
            worker = container "Fulfillment Worker" "Processes asynchronous fulfillment jobs" "Node.js"
            db = container "Orders Database" "Stores order state" "PostgreSQL" "Database"
            queue = container "Fulfillment Queue" "Buffers fulfillment jobs" "RabbitMQ" "Queue"
        }

        payment = softwareSystem "Payment Provider" "Processes card payments" "External"
        email = softwareSystem "Email Delivery Service" "Sends order confirmation emails" "External,Inferred"

        customer -> ordering.webApp "Places and tracks orders using" "HTTPS"
        ordering.webApp -> ordering.api "Calls" "HTTPS/JSON"
        ordering.api -> ordering.db "Reads from and writes to" "SQL"
        ordering.api -> ordering.queue "Publishes fulfillment jobs to" "AMQP"
        ordering.worker -> ordering.queue "Consumes fulfillment jobs from" "AMQP"
        ordering.worker -> payment "Captures payments using" "HTTPS/JSON"
        ordering.worker -> email "Sends order confirmations using" "SMTP" "Inferred"

        production = deploymentEnvironment "Production" {
            deploymentNode "Application Cluster" "Runs stateless workloads" "Kubernetes" {
                deploymentNode "Web Pod" "Serves the web application bundle" "nginx" {
                    containerInstance ordering.webApp
                }
                deploymentNode "API Pod" "Runs the Orders API" "Docker" {
                    containerInstance ordering.api
                }
                deploymentNode "Worker Pod" "Runs the fulfillment worker" "Docker" {
                    containerInstance ordering.worker
                }
            }
            deploymentNode "Data Services" "Stateful services" "Virtual machines" {
                deploymentNode "Database Server" "Primary relational store" "PostgreSQL 16" {
                    containerInstance ordering.db
                }
                deploymentNode "Message Broker" "Hosts fulfillment queues" "RabbitMQ 3.13" {
                    containerInstance ordering.queue
                }
            }
        }
    }

    views {
        systemContext ordering "OrderingSystemContext" {
            include *
            autoLayout lr
        }

        container ordering "OrderingSystemContainers" {
            include *
            autoLayout lr
        }

        deployment ordering production "OrderingSystemProduction" {
            include *
            autoLayout lr
        }

        dynamic ordering "OrderFulfillment" "Simplified order fulfillment flow" {
            customer -> ordering.webApp "Submits order"
            ordering.webApp -> ordering.api "Creates order"
            ordering.api -> ordering.queue "Publishes fulfillment job"
            ordering.worker -> ordering.queue "Consumes fulfillment job"
            ordering.worker -> payment "Captures payment"
            autoLayout lr
        }

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
