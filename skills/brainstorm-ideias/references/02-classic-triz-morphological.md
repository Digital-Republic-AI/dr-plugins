# Brainstorming and Disruptive Ideas - Classic Frameworks: TRIZ, Morphological Analysis and Systematic Methods

> Research Date: 2026-04-29
> Angle: Classic frameworks - TRIZ, Morphological Analysis, Synectics and systematic invention methods
> Depth: detailed
> Goal: Apply personally
> Knowledge Level: Basic

## Overview

This document covers the most "engineering-minded" methods of idea generation: approaches that treat creativity as a systematic, repeatable process rather than innate talent. What TRIZ, Zwicky's Morphological Analysis, Synectics and Crawford's Attribute Listing have in common is the premise that complex problems follow recognizable patterns — and that these patterns can be cataloged, taught and applied deliberately.

For someone starting at a basic level, these frameworks look intimidating on first reading. In practice, each one offers a small set of questions or operations that, applied methodically, break creative blocks and generate options that spontaneous reasoning rarely reaches. The investment in learning the initial mechanics is rewarded by the consistency of the results.

This document does not cover Design Thinking, SCAMPER or the Six Hats, which are treated in other files in this series. The focus here is TRIZ (including simplified ARIZ), Morphological Analysis (Zwicky Box), Synectics and Crawford's Attribute Listing.

## TRIZ — Theory of Inventive Problem Solving

### Origin and Historical Context

TRIZ is the Russian acronym for "Teoriya Resheniya Izobretatelskikh Zadach" (Theory of Inventive Problem Solving). It was developed by the Soviet inventor Genrich Altshuller starting in 1946, when he worked in the inventions inspection department of the Soviet Navy. By analyzing hundreds of thousands of patents from different fields, Altshuller realized that genuinely innovative solutions follow recurring patterns — and that the same contradiction-resolution strategies reappeared in completely different sectors. ([TRIZ - Wikipedia](https://en.wikipedia.org/wiki/TRIZ))

The development was interrupted when Altshuller was arrested in 1950 for criticizing Soviet policies, receiving a 25-year sentence of forced labor. After Stalin's death, he was released and resumed his research. The first academic publication appeared in 1956. Decades later, companies such as Samsung, Intel, Boeing, NASA and Johnson & Johnson formally adopted TRIZ — Intel documented a return of US$ 212.5 million in 21 months of application. ([TRIZ: The Backbone of Innovation - Quality Magazine](https://www.qualitymag.com/articles/98566-triz-the-backbone-of-innovation-and-problem-solving))

### Central Premise: Contradictions are the Source of Innovation

Altshuller identified that most difficult technical problems exist because improving one parameter degrades another. This tension is called a **contradiction**. The central insight of TRIZ is: instead of seeking a compromise (accepting a loss on both sides), the inventor should eliminate the contradiction — and proven strategies exist for that.

There are two main types of contradiction:

**Technical Contradiction:** improving parameter A worsens parameter B.
- Example: increasing the strength of a structure increases its weight.
- Example: increasing the speed of a process increases errors.

**Physical Contradiction:** the system needs to both have and not have a property at the same time.
- Example: a drug needs to be soluble (to be absorbed) and insoluble (to have extended release).
- Example: a surgical knife needs to be sharp (to cut) and not sharp (to avoid damaging adjacent tissue).

([TRIZ Contradiction Matrix - TRIZ Knowledge Base](https://wiki.matriz.org/knowledge-base/triz/problem-solving-tools-5890/contradictions/engineering-contradiction-5995/contradiction-matrix-6026/))

### The Ideal Final Result (IFR)

Before seeking solutions, TRIZ proposes defining the **Ideal Final Result** (IFR): the perfect situation where the problem solves itself, at no cost and with no side effects. The IFR works as a compass — it is not necessarily achievable, but it guides the right direction and prevents solutions that merely shift the problem elsewhere.

Questions for defining the IFR:
- "What do I want to happen, with no constraints whatsoever?"
- "How would the system solve the problem by itself?"
- "Which resources already existing in the system could do the job without adding anything new?"

Example: when designing a faster hospital thermometer, the IFR would be "the patient reports their own temperature accurately, with no external intervention". This may seem absurd, but it led to solutions such as infrared ear sensors that read temperature without contact.

### The 39 Engineering Parameters

To use the TRIZ Contradiction Matrix, the problem must be translated into the 39 standardized parameters. They describe system attributes that can be in conflict. The ones most relevant for product and business problems include:

| # | Parameter | Application Examples |
|---|-----------|----------------------|
| 1 | Weight of moving object | Shipping cost, ergonomics |
| 9 | Speed | Delivery time, processing |
| 10 | Force | Capacity, power |
| 12 | Shape | Design, interface |
| 13 | Stability of the object's composition | Product consistency |
| 25 | Loss of time | Operational efficiency |
| 26 | Quantity of substance | Volume, scalability |
| 28 | Measurement accuracy | Data quality |
| 33 | Ease of operation | User experience |
| 39 | Productivity | Throughput, capacity |

([Appendix I: 39 Parameters - Wiley Online Library](https://onlinelibrary.wiley.com/doi/pdf/10.1002/9780470684320.app1))

### The Contradiction Matrix

The Contradiction Matrix is a 39×39 table where the rows represent the parameter to be improved and the columns represent the parameter that worsens as a result. Each cell contains the numbers of the Inventive Principles (from 1 to 40) most frequently used historically to resolve that specific contradiction.

How to use it:
1. Identify the parameter you want to improve (row).
2. Identify the parameter that is worsening (column).
3. Find the intersection cell — it lists 1 to 4 principles.
4. Read each suggested principle and adapt it to your context.

The matrix is available for free at: [TRIZ Contradiction Matrix Online](https://www.triz40.com/aff_Matrix_TRIZ.php)

### The 40 Inventive Principles

The 40 Inventive Principles are generic solution strategies. Below are all of them with application examples in product and personal/corporate contexts:

| # | Principle | What it means | Product/business example |
|---|-----------|---------------|--------------------------|
| 1 | Segmentation | Divide into independent parts | SaaS by modules; software with separate features |
| 2 | Taking out | Separate the problematic part from the rest | Air-conditioning compressor moved outside the building |
| 3 | Local quality | Make each part ideal for its function | Ergonomic keyboard with different zones for each hand |
| 4 | Asymmetry | Replace a symmetrical shape with an asymmetrical one | Packaging with an easy-open tab on one side |
| 5 | Merging | Combine similar objects or operations | Smartphone = camera + GPS + bank + entertainment |
| 6 | Universality | One part performs multiple functions | Swiss army knife; all-in-one tool |
| 7 | Nested doll | Place objects inside others | Retractable headphones; foldable screens |
| 8 | Anti-weight | Compensate for weight with an opposing force | Drone with automatic wind compensation |
| 9 | Preliminary anti-action | Apply preventive tension before the main action | Pre-compressed springs; vaccines |
| 10 | Preliminary action | Make the necessary change before it is needed | Culinary mise en place; data pre-processing |
| 11 | Beforehand cushioning | Prepare an emergency mechanism | Airbag; automatic backups |
| 12 | Equipotentiality | Eliminate the need to raise or lower | Ramp instead of stairs; level interface |
| 13 | The other way round | Invert the action or relationship | Glove that turns inside out when removed; freemium |
| 14 | Spheroidality - Curvature | Replace linear with curvilinear | Infinite scrolling; rounded interfaces |
| 15 | Dynamics | Allow adaptation to conditions | Adjustable seats; dynamic pricing |
| 16 | Partial or excessive actions | Use slightly more or less and adjust | Printing with excess ink that is later scraped off |
| 17 | Another dimension | Move to a different dimension | 3D app; data on another abstraction layer |
| 18 | Mechanical vibration | Use oscillation or vibration | Ultrasonic cleaning; vibration massage |
| 19 | Periodic action | Replace continuous with intermittent | Batched notifications instead of continuous ones |
| 20 | Continuity of useful action | Work continuously at full load | Background processing; asynchronous queues |
| 21 | Skipping | Conduct a process at high speed to avoid side effects | Laser cutting; instant credit approval |
| 22 | Blessing in disguise | Use a harmful factor for a positive effect | Server heat used to warm a building |
| 23 | Feedback | Introduce feedback to improve control | Continuous A/B testing; NPS with follow-up |
| 24 | Intermediary | Use an intermediary object or process | Middleware; marketplace platforms |
| 25 | Self-service | Make the object serve itself | Self-checkout; self-testing code |
| 26 | Copying | Replace the original with a simpler copy | Simulators; paper prototyping |
| 27 | Cheap short-living objects | Sacrifice quality in exchange for low cost | Disposable syringes; MVPs |
| 28 | Mechanics substitution | Replace mechanical with sensory or field-based | Presence sensor instead of a switch |
| 29 | Pneumatics and hydraulics | Use gas or liquid parts | Air shock absorbers; hydraulic brakes |
| 30 | Flexible shells and thin films | Use membranes instead of rigid structures | Flexible packaging; foldable OLED screens |
| 31 | Porous materials | Make the object porous for additional functions | Filtering membranes; acoustic foams |
| 32 | Color changes | Change color or transparency | Photochromic glass; temperature indicators |
| 33 | Homogeneity | Interacting objects made of the same material | Container made of the same material as its contents |
| 34 | Discarding and recovering | Used parts disappear or are restored | Biodegradable components; renewable resources |
| 35 | Parameter changes | Change state, concentration, flexibility | Change temperature, pH, pressure |
| 36 | Phase transitions | Use phase-change phenomena | Dry ice; evaporative cooling |
| 37 | Thermal expansion | Use expansion or contraction from temperature | Thermostats; expansion joints |
| 38 | Strong oxidants | Replace ordinary air with enriched air | Pure oxygen in welding; oxygen concentrators |
| 39 | Inert atmosphere | Replace the normal environment with an inert one | Vacuum packaging; nitrogen storage |
| 40 | Composite materials | Replace a uniform material with a composite | Carbon fiber; reinforced concrete |

([TRIZ 40 Principles - triz40.com](https://www.triz40.com/aff_Principles_TRIZ.php))

### Simplified ARIZ — For Complex Problems

ARIZ (Algorithm of Inventive Problem Solving) is the most advanced tool in TRIZ — a sequence of about 85 steps that transforms complex problems until the solution becomes obvious. For initial use, a simplified 6-step version is enough:

**Step 1 — Mini-problem:** Reformulate the problem without mentioning any solution. Focus on the central contradiction. Example: "The system must [desired function] without [undesired effect]."

**Step 2 — Conflict model:** Identify the two elements in conflict and the zone where the conflict occurs.

**Step 3 — Ideal Final Result:** State what the system would do if it worked perfectly, without external intervention.

**Step 4 — Physical contradiction:** Formulate it as "element X must be [property A] for [function 1] and must be [property opposite to A] for [function 2]".

**Step 5 — System resources:** List all available resources: substances, fields, time, space, and existing functions that have not yet been explored.

**Step 6 — Solution through separation:** Resolve the physical contradiction using one of the four separation principles: separation in time, in space, between parts and whole, or upon condition.

([ARIZ - Mycoted](https://www.mycoted.com/Algorithm_of_Inventive_Problem_Solving)) | ([Medium - Unlocking Innovation with TRIZ](https://medium.com/@fabio.vargas/unlocking-innovation-with-triz-a-comprehensive-guide-to-the-theory-of-inventive-problem-solving-9803a2caea1))

### Worked Example: TRIZ on a Digital Product Problem

**Problem:** A productivity app needs to send notifications to keep the user engaged, but frequent notifications annoy users and lead them to turn the app off.

**Technical contradiction:**
- Parameter to improve: Ease of operation (parameter 33) — more notifications increase engagement.
- Parameter that worsens: Loss of time (parameter 25) — frequent notifications interrupt the workflow.

**Matrix lookup:** The 33×25 intersection suggests principles 1 (Segmentation), 16 (Partial or excessive actions) and 25 (Self-service).

**Applying the principles:**
- Principle 1 (Segmentation): group notifications into time blocks instead of sending them individually.
- Principle 25 (Self-service): let the user define when they want to be interrupted — the system learns the pattern and notifies only at the preferred moment.
- Principle 16 (Partial action): send a daily summary instead of real-time notifications.

**Result:** Batched notifications at a user-defined time, with an intelligent summary — a solution that eliminates the contradiction instead of choosing between engagement and comfort.

## Zwicky's Morphological Analysis

### Origin and Context

General Morphological Analysis was developed by the Swiss astronomer Fritz Zwicky at the California Institute of Technology (Caltech) in the 1940s. Zwicky originally applied the method to rocket propulsion systems and astronomical studies, but recognized its universal applicability to any multidimensional problem that resists quantification. ([Morphological Analysis - Wikipedia](https://en.wikipedia.org/wiki/Morphological_analysis_(problem-solving)))

The premise is simple: any complex system can be decomposed into independent parameters, each with multiple possible states. The innovative solution is often a combination of states that nobody considered because the total space of combinations is too large to be explored intuitively.

### The Morphological Box (Zwicky Box)

The Zwicky Box is a matrix where:
- **Rows** = parameters (dimensions of the problem)
- **Columns** = possible variants for each parameter

Each path traced through the matrix — choosing one variant per parameter — represents a distinct candidate solution. With 5 parameters and 5 variants each, the total space is 5⁵ = 3,125 combinations. Most would never be considered spontaneously. ([The Zwicky Box - Ness Labs](https://nesslabs.com/zwicky-box))

### Step by Step

**Step 1 — Define the problem:** State clearly what is being designed or solved. Be specific: "How to monetize a meditation app for college students?"

**Step 2 — Identify the parameters:** List the independent, relevant dimensions of the problem. Usually 4 to 7 parameters produce manageable results. Avoid parameters that depend on each other (this will be handled in the Cross-Consistency Assessment).

**Step 3 — List variants for each parameter:** For each parameter, brainstorm 3 to 6 real, distinct variants. Variants must be mutually exclusive within the same parameter.

**Step 4 — Assemble the Morphological Box:** Organize it in the table.

**Step 5 — Generate combinations:** Trace lines connecting one variant of each parameter. Explore random combinations first to break familiarity bias, then explore combinations guided by intuition or hypotheses.

**Step 6 — Cross-Consistency Assessment (CCA):** Compare pairs of variants from different parameters and eliminate combinations that are logically contradictory, empirically implausible or ethically unacceptable. This step dramatically reduces the solution space without introducing premature judgment about value. ([General Morphological Analysis - swemorph.com](https://www.swemorph.com/ma.html))

**Step 7 — Analyze the remaining space:** The combinations that survive the CCA form the "viable solution space". Within it, prioritize the most interesting ones for prototyping or deeper exploration.

### Worked Example: Morphological Box for a New Product

**Problem:** Create a new online learning service for professionals.

| Parameter | Variant A | Variant B | Variant C | Variant D |
|-----------|-----------|-----------|-----------|-----------|
| Content format | Short video | Interactive text | Podcast | Live session with an expert |
| Revenue model | Monthly subscription | Pay per course | Freemium | Corporate B2B |
| Target audience | Beginners | Mid-level professionals | Senior leaders | Undergraduate students |
| Delivery | Asynchronous | Synchronous | Hybrid | On-demand |
| Differentiator | Certification | Community | Personalized AI | Human mentoring |

**Total formally possible combinations:** 4 × 4 × 4 × 4 × 4 = 1,024

**After CCA — logical eliminations:**
- "Live session with an expert" + "Asynchronous" = contradiction (eliminate)
- "Freemium" + "Human mentoring" = economically implausible (eliminate)
- "Beginners" + "Senior leaders" = impossible simultaneously (eliminate)

**Interesting combinations that emerge:**
- Short video + Freemium + Beginners + On-demand + Personalized AI → Duolingo-style platform for soft skills
- Podcast + Corporate B2B + Senior leaders + Asynchronous + Community → exclusive podcast club for executives
- Live session with an expert + Pay per course + Mid-level professionals + Synchronous + Certification → live bootcamp with a recognized credential

The Morphological Box does not produce the ready-made solution — it produces the map of unexplored possibilities.

### Reducing the Combination Space

The CCA uses a matrix of pairs. For each pair of variants (from different parameters), it is marked as:
- **OK** = the two can coexist
- **Logical contradiction** = impossible by definition
- **Implausible** = can exist but is highly unlikely
- **Excluded by normative criterion** = out of scope by a value decision

The efficiency of the CCA comes from the different growth of combinations versus pairs: combinations grow exponentially, while pairs grow only as a quadratic polynomial. A box with 100,000 combinations requires only a few hundred pair evaluations. ([swemorph.com](https://www.swemorph.com/ma.html))

## Synectics — The Method of Analogies

### Origin and Founders

Synectics was developed by William J.J. Gordon (1919–2003) and George M. Prince (1918–2009) at the Invention Design Unit of Arthur D. Little, in the 1950s. The name comes from the Greek and means "the joining together of different and apparently unrelated elements". The method was documented by Gordon in the book "Synectics: The Development of Creative Capacity" (1961). ([Synectics - Wikipedia](https://en.wikipedia.org/wiki/Synectics))

The central premise is Gordon's: "Make the familiar strange and the strange familiar". Innovation occurs when we use known structures from one domain to illuminate problems from a completely different domain.

Synectics rests on three premises:
1. The creative process can be taught and reproduced.
2. Creativity in the arts and sciences uses the same mental mechanisms.
3. Individual and group creativity work in an analogous way.

### The Four Types of Analogy

#### Direct Analogy

A direct comparison between the problem and something from another domain — often from nature.

Trigger question: "How does nature solve a similar problem?"

Examples:
- Problem: create a fastening system that does not damage the surface. Direct analogy: the gecko attaches to any surface with microscopic bristles, without adhesive. Result: reusable microstructure materials.
- Problem: create a learning product that adapts to the user. Direct analogy: the immune system learns to recognize threats without explicit instruction. Result: adaptive learning algorithms.

#### Personal Analogy

The participant identifies emotionally with the object or problem — literally imagining themselves as the element in question.

Trigger question: "If I were [element of the problem], how would I feel? What would I want?"

Example:
- Problem: improve the onboarding experience of a software product. Personal analogy: "I am the new user. I am anxious, I do not know where to start, I am afraid of making mistakes and losing data. I want an anchor, a clear and safe starting point." This leads to designs that highlight a single possible action on first access, instead of presenting all the features.

#### Symbolic Analogy (Compressed Conflict)

Creating pairs of paradoxical words — oxymorons — that capture the essence of the problem. The tension between the words reveals the central contradiction.

Process: describe the problem in two adjectives that contradict each other.

Examples of compressed conflicts:
- "Loud silence" — for a product that needs to be imperceptible but effective
- "Structured freedom" — for a creative process with productive constraints
- "Simple complexity" — for an advanced but intuitive interface
- "Vulnerable security" — for a system that exposes itself in order to protect itself (such as a honeypot)

The compressed conflict serves as a lens: the group explores what it would mean to resolve this paradoxical tension.

#### Fantasy Analogy

Completely suspends the laws of physics, logic and common sense to imagine the ideal solution without constraints.

Trigger question: "If I could use any magical resource, how would I solve this?"

Example:
- Problem: eliminate queues in emergency rooms. Fantasy analogy: "The doctor appears telepathically at the exact moment the patient starts to feel the symptom, before they need to leave home." This leads to ideas such as symptom triage via an app before arrival, remote consultation with advance prescription, or continuous monitoring by wearables.

([Synectics - Geniusrevive](https://geniusrevive.com/en/synectics/))

### Running a Synectics Session

Recommended group: 6 to 8 people, with a trained facilitator. Duration: 90 to 120 minutes.

**Phase 1 — Problem statement:** The problem owner presents it as a wish: "I wish [result], but the obstacle is [constraint]."

**Phase 2 — Direct analogy:** The facilitator asks for direct analogies. The group generates freely for 5 to 10 minutes. All analogies are written down without judgment.

**Phase 3 — Personal analogy:** The facilitator chooses the analogy furthest from the original problem and asks the group to identify with it. "Be the sponge. What do you feel when you are completely soaked?"

**Phase 4 — Compressed conflict:** From the responses of the previous phase, the facilitator extracts paradoxical pairs. The group votes on the most intriguing pair.

**Phase 5 — Fantasy analogy:** Using the compressed conflict as a starting point, the group imagines solutions without constraints.

**Phase 6 — Return to the problem:** The facilitator leads the group back to the original problem with the images and ideas generated. The question is: "How could we transfer this fantasy idea to our real context?"

**Phase 7 — Evaluation:** The most promising ideas are evaluated for feasibility and impact.

### Worked Example: Synectics for a Product

**Problem:** "I wish to create a corporate feedback service that is honest, but the obstacle is that people fear retaliation."

**Direct analogy:** "How does nature solve the problem of communicating something important without exposing oneself?" — The octopus changes color to camouflage and communicate its emotional state at the same time. The cuckoo lays its eggs in another bird's nest. Fungi communicate warnings through invisible underground networks.

**Personal analogy:** "I am the feedback. When nobody gives me a voice, I get dammed up, fermenting, building pressure. When I finally come out, it is already an explosion, not a conversation."

**Compressed conflict:** "Protected transparency" or "Safe exposure".

**Fantasy analogy:** "Imagine there is a neutral entity with no identity — an average of all opinions — that speaks with its own voice, with nobody able to trace where it came from."

**Return to the problem:** This leads to solutions such as: an anonymous feedback system with aggregated visualization that reveals only trends (not individuals), mediated by AI that synthesizes the comments into patterns without attribution.

## Crawford's Attribute Listing

### Origin and Method

Developed by Robert P. Crawford in the 1930s and documented in "The Techniques of Creative Thinking" (1954). It is the simplest of the four methods in this document — and for that reason is often underestimated. Attribute Listing starts from the premise that every innovation is, to some extent, a modification of something that already exists. ([Attribute Listing - Mycoted](https://www.mycoted.com/Attribute_Listing))

### Step by Step

**Step 1:** Choose the product, service or process you want to improve.

**Step 2:** Exhaustively list all its attributes — physical, functional, sensory, emotional, pricing, distribution, brand.

**Step 3:** For each attribute, ask: "What would happen if I changed, exaggerated, minimized, replaced, combined or eliminated this attribute?"

**Step 4:** Record all ideas generated, however absurd they may seem.

**Step 5:** Evaluate and prioritize.

### Worked Example: Attribute Listing for a Corporate Meeting

**Object:** Weekly team alignment meeting.

| Attribute | Current State | Possible Variations |
|-----------|---------------|---------------------|
| Duration | 60 minutes | 15 min / 5 min / asynchronous |
| Format | In person or video call | Written text / asynchronous audio / walk and talk |
| Participants | The whole team | Only those with decision power / rotating / leaderless |
| Frequency | Weekly | Quick daily / biweekly / on demand |
| Agenda | Defined by the leader | Co-created / no agenda / a single central question |
| Output | Notes by email | Decisions recorded in a system / no meeting = no decision |
| Schedule | Fixed business hours | Rotating / chosen by the team / eliminated |

From this table, concepts emerge such as: replacing the weekly meeting with an asynchronous document where each member answers a single question by Friday at 5 pm — leadership reads and replies if necessary. A real meeting only when there is a decision that cannot be made asynchronously.

### Relationship with Morphological Analysis

Attribute Listing and Morphological Analysis are complementary. The practical difference:
- **Attribute Listing** starts from something existing and asks how to modify each attribute.
- **Morphological Analysis** starts from scratch or from a problem and builds the space of possibilities in a structured way.

Attribute Listing is faster and suited to incremental improvements. Morphological Analysis is more powerful for disruptive innovations and for exploring completely new spaces.

## Comparison of the Four Methods

| Dimension | TRIZ | Morphological Analysis | Synectics | Attribute Listing |
|-----------|------|------------------------|-----------|-------------------|
| Origin | Soviet engineering, 1946 | Astronomy, 1940s | Creative psychology, 1950s | Creative education, 1930s |
| Starting point | Contradiction to be resolved | Multidimensional problem | Problem formulated as a wish | Existing product/process |
| Core mechanism | Historical inventive principles | Systematic combinations | Analogies and metaphors | Attribute modification |
| Learning effort | High (entry curve) | Medium | Medium (requires a facilitator) | Low |
| Expected result | Solution that eliminates the contradiction | Map of viable combinations | Ideas through analogical transfer | Ideas through attribute variation |
| Best for | Technical problems with a clear trade-off | New product / strategy | Problems that are hard to articulate | Improvements to an existing product |
| Individual application | Difficult without study | Easy | Ideally requires a group | Very easy |
| Team application | Possible with a TRIZ facilitator | Excellent | Excellent | Good |

## When to Use Each Method

**Use TRIZ when:**
- There is a clear technical contradiction: "the more X, the less Y"
- The problem is recurring and no previous solution has eliminated the root cause
- You want solutions inspired by proven patterns from other industries

**Use Morphological Analysis when:**
- You need to explore a completely new design or strategy space
- There are multiple independent parameters and you suspect non-obvious combinations exist
- You want to ensure systematic coverage before making a decision

**Use Synectics when:**
- The problem is well defined but nobody can generate radically different ideas
- There is a creative block or looping thinking in the group
- The problem has a strong emotional or social component (not just technical)

**Use Attribute Listing when:**
- You have an existing product or process that needs to be improved
- You want a quick method (30 to 60 minutes) without extensive preparation
- You are alone and need a structured starting point

## Personal Application — Practical Adaptations

All of these methods were created for R&D and engineering contexts. For personal and everyday use, a few adaptations make adoption easier:

**Simplified TRIZ for personal decisions:**
1. Define the contradiction: "I want [X] but doing [X] causes [undesired Y]"
2. Look for the most intuitive Inventive Principle for your case (segmentation, inversion, self-service, preliminary action are the most versatile)
3. Apply the principle as a question: "How could I segment this problem into smaller parts that do not create the same trade-off?"

**Personal Morphological Box:**
- Use a simple spreadsheet
- Limit it to 4 parameters and 4 variants each to start (256 combinations, manageable)
- Reserve 20 minutes for the CCA before evaluating combinations

**Individual Synectics:**
- Choose a direct analogy from nature for your problem
- Write for 10 minutes as if you were the central element of the problem
- Formulate the compressed conflict in two paradoxical adjectives
- Ask: "If it were magic, how would I solve it?"
- Return to the problem with the images generated

**Attribute Listing:**
- Works perfectly alone, in 30 minutes, with pen and paper
- It is the recommended entry point for anyone who has never used systematic creativity methods

## Key Takeaways

1. TRIZ treats innovation as a science: difficult problems have identifiable contradictions, and contradictions have proven, cataloged solution principles. The entry curve is high, but the method is extraordinarily powerful for those who master it.

2. Zwicky's Morphological Analysis does not produce the solution — it produces the map of possibilities that spontaneous thinking would never cover. The Cross-Consistency Assessment (CCA) is the critical step that turns a theoretical exercise into a practical tool.

3. Synectics accesses the creative subconscious through deliberate analogies. The four types of analogy (direct, personal, symbolic and fantasy) are progressive strategies of distancing from the problem — the further away, the more surprising the return.

4. Crawford's Attribute Listing is the most accessible method and the best entry point for anyone starting with systematic creativity techniques. Every innovation is a modification — and this method makes the modifications explicit and systematic.

5. The four methods are complementary, not competing. A natural sequence: Attribute Listing to understand what exists, Morphological Analysis to map the new space, Synectics to generate radical ideas, TRIZ to resolve the contradictions that arise during refinement.

6. The difference between these methods and free brainstorming is not the quantity of ideas — it is systematic coverage and the reduction of familiarity bias. They force exploration of regions of the possibility space that habitual thinking never visits.

## Sources

- [TRIZ - Wikipedia](https://en.wikipedia.org/wiki/TRIZ) - Complete history, fundamental concepts and industrial applications
- [40 Principles of Invention - Wikipedia](https://en.wikipedia.org/wiki/40_principles_of_invention) - List and description of the 40 inventive principles
- [TRIZ: The Backbone of Innovation - Quality Magazine](https://www.qualitymag.com/articles/98566-triz-the-backbone-of-innovation-and-problem-solving) - Corporate use cases and documented ROI
- [TRIZ Contradiction Matrix Online - triz40.com](https://www.triz40.com/aff_Matrix_TRIZ.php) - Free interactive tool for consulting the matrix
- [40 Inventive Principles - triz40.com](https://www.triz40.com/aff_Principles_TRIZ.php) - Complete list of the 40 principles with examples
- [39 Parameters - Wiley Online Library](https://onlinelibrary.wiley.com/doi/pdf/10.1002/9780470684320.app1) - Technical reference for the 39 engineering parameters
- [TRIZ Contradiction Matrix - TRIZ Knowledge Base](https://wiki.matriz.org/knowledge-base/triz/problem-solving-tools-5890/contradictions/engineering-contradiction-5995/contradiction-matrix-6026/) - Detailed explanation of technical and physical contradictions
- [ARIZ - Algorithm of Inventive Problem Solving - Mycoted](https://www.mycoted.com/Algorithm_of_Inventive_Problem_Solving) - Overview of ARIZ and its objectives
- [Unlocking Innovation with TRIZ - Medium](https://medium.com/@fabio.vargas/unlocking-innovation-with-triz-a-comprehensive-guide-to-the-theory-of-inventive-problem-solving-9803a2caea1) - Practical guide focused on application
- [Morphological Analysis - Wikipedia](https://en.wikipedia.org/wiki/Morphological_analysis_(problem-solving)) - Fundamental concepts and history of Zwicky
- [General Morphological Analysis - swemorph.com](https://www.swemorph.com/ma.html) - Complete method including CCA, examples and real cases
- [The Zwicky Box - Ness Labs](https://nesslabs.com/zwicky-box) - Practical tutorial with digital product examples
- [Morphological Analysis - Toolshero](https://www.toolshero.com/creativity/morphological-analysis-fritz-zwicky/) - Applications in management and corporate innovation
- [Synectics - Wikipedia](https://en.wikipedia.org/wiki/Synectics) - Origin, founders and principles of the method
- [Synectics - Geniusrevive](https://geniusrevive.com/en/synectics/) - Four types of analogy and session structure
- [Attribute Listing - Mycoted](https://www.mycoted.com/Attribute_Listing) - Crawford's method with practical guidance
- [Attribute Listing - getpersonalgrowth.com](https://www.getpersonalgrowth.com/en/rp-crawford-s-attribute-list-a-technique-for-empowering-creativity) - Crawford and contemporary applications
