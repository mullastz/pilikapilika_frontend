# PILIKA PILIKA — Frontend Improvements: QR Assignment, PDF Output & Agent Transport Modes

## Objective

Implement the following improvements in the existing PILIKA PILIKA Angular frontend.

**Project root:**

```text
C:\Users\RM\pilikapilika-main\pilikapilika_frontend
```

This is a production-oriented modification. Preserve all existing functionality unless a change is explicitly required below.

Do not redesign unrelated features, remove existing data, change backend contracts unnecessarily, or introduce mock/static business data.

---

# 1. QR Generator — Assign Agent Flow

**Primary file:**

```text
src\app\feature\qr-generator\qr-generator.html
```

Inspect the corresponding TypeScript component, services, models/interfaces, API integration, and existing assignment logic before making changes.

The **Assign Agent** flow must follow this dependency order:

```text
Transport Method
      ↓
Agent
      ↓
Agent Address
```

## 1.1 Choose Transport Method First

The user must first choose one transport method:

- Air Freight
- Sea Freight

The selected transport method determines the valid agents and addresses that can subsequently be selected.

---

## 1.2 Choose Agent

After selecting the transport method, allow the user to choose an agent that supports the selected transport method.

Do not present an agent as valid for a transport method if that agent does not support it.

Use the existing backend/API data and project models where available. Do not hard-code agent capabilities.

---

## 1.3 Choose Address for the Selected Agent

After the user selects an agent, display only addresses belonging to that agent **and matching the selected transport method**.

The address relationship must be:

```text
Selected Transport Method
        +
Selected Agent
        ↓
Applicable Agent Addresses
```

Never mix transport-specific addresses.

For example:

```text
Air Freight
    ↓
Agent A
    ↓
Only Agent A's Air Freight addresses
```

and:

```text
Sea Freight
    ↓
Agent A
    ↓
Only Agent A's Sea Freight addresses
```

Do not display a sea-freight address when Air Freight is selected, and vice versa.

---

## 1.4 Automatic Address Selection

If the selected agent has exactly **one** applicable address for the selected transport method:

- Automatically select that address.
- Do not force the user to manually select it.

Example:

```text
Transport: Air Freight
Agent: ABC Logistics
Address: Beijing Airport Warehouse
```

The address should automatically become the selected address.

---

## 1.5 Multiple Addresses

If the selected agent has more than one applicable address for the selected transport method:

- Display all applicable addresses.
- Require the user to select one.

Example:

```text
Select Address

○ Guangzhou Airport Warehouse
○ Shanghai Airport Warehouse
○ Shenzhen Airport Warehouse
```

Do not automatically select an arbitrary address when multiple valid addresses exist.

---

## 1.6 Dependent-State Reset and Validation

The selection dependency must be enforced:

```text
Transport Method
      ↓
Agent
      ↓
Address
```

If the user changes the transport method:

```text
Air Freight → Sea Freight
```

re-evaluate the selected agent and address.

If the previously selected agent is not valid for Sea Freight, clear/reset the agent.

If the previously selected address is not valid for the new transport/agent combination, clear/reset the address.

Likewise:

```text
Sea Freight → Air Freight
```

must re-evaluate all dependent selections.

Never submit an invalid combination of:

```text
Transport + Agent + Address
```

The UI and validation must prevent invalid assignment.

---

# 2. CRITICAL PDF RULE — PDF OUTPUT ONLY

This requirement is extremely important.

The reduction of product details applies **ONLY to the generated PDF output**.

It does **NOT** mean removing, hiding, deleting, renaming, or modifying product information anywhere else in the application.

For the generated PDF, the product section must contain ONLY:

1. Product Name
2. Package Type
3. Quantity

The generated PDF must NOT contain:

- Description
- Total Weight
- Volume

---

## 2.1 DO NOT Modify Existing Product Data

The following must remain intact throughout the application:

- Product Name
- Package Type
- Quantity
- Description
- Total Weight
- Volume
- Any other existing product fields

Do not remove these properties from:

- Angular models/interfaces
- TypeScript objects
- API responses
- API requests
- Forms
- Form controls
- Application state
- Services
- Backend/database data
- Validation
- Product creation
- Product editing
- Product display
- Product management
- Existing business logic

The application must continue to collect, store, display, edit, validate, and use the existing product information exactly as it currently does.

### The only change is at PDF generation time.

Conceptually:

```text
Existing Product Data
│
├── Product Name
├── Package Type
├── Quantity
├── Description
├── Total Weight
├── Volume
└── Other existing fields
│
└── PDF Generation
        │
        └── PDF representation contains ONLY:
              ├── Product Name
              ├── Package Type
              └── Quantity
```

Do not mutate or strip fields from the original product object simply to generate the PDF.

Use the existing PDF-generation architecture where possible. If the project already has a PDF DTO, view model, formatter, or mapping layer, use that rather than introducing unnecessary duplication.

---

# 3. QR Generator — Preserve the Entire Existing UI

**File:**

```text
src\app\feature\qr-generator\qr-generator.html
```

The QR Generator page contains product information and functionality that must remain intact.

Do NOT remove or hide product details from the QR Generator UI merely because they are not required in the PDF.

If the current page displays or uses:

- Product Name
- Package Type
- Quantity
- Description
- Total Weight
- Volume
- Any other product information

all of them must remain available exactly as they are.

The following must remain unchanged unless directly required by the Assign Agent feature:

- Existing product fields
- Existing forms
- Existing controls
- Existing validation
- Existing product information
- Existing product interactions
- Existing QR-generation functionality
- Existing API integration
- Existing business logic

Only the **PDF output** should omit Description, Total Weight, and Volume.

---

# 4. My Products — Preserve the Entire Existing UI and Functionality

**File:**

```text
src\app\feature\my-products\my-products.html
```

The same PDF-only rule applies here.

The normal My Products interface must remain intact.

Do NOT remove, hide, disable, or modify existing product information such as:

- Product Name
- Package Type
- Quantity
- Description
- Total Weight
- Volume
- Any other existing product fields

Do not remove fields from:

- UI
- Forms
- Models/interfaces
- API payloads
- API responses
- Product objects
- Services
- State
- Validation
- Product management functionality

The user must still be able to see and use all existing product information in My Products.

### Only the generated PDF changes.

When a PDF is generated from My Products, the PDF must contain:

```text
Product Name
Package Type
Quantity
```

and must exclude:

```text
Description
Total Weight
Volume
```

The source product data remains unchanged.

---

# 5. Both PDF Generation Paths Must Follow the Same Rule

There are two relevant PDF-generation paths:

### QR Generator

```text
src/app/feature/qr-generator/
```

### My Products

```text
src/app/feature/my-products/
```

Both PDF outputs must follow exactly this rule:

```text
PDF OUTPUT

✓ Product Name
✓ Package Type
✓ Quantity

✗ Description
✗ Total Weight
✗ Volume
```

This is a **presentation/output requirement only**.

Do not interpret it as a request to remove those fields from the application.

---

# 6. Agent Dashboard — Replace Containers Button With Transport Category Toggle

**Primary file:**

```text
src\app\feature\shipping\shipping.html
```

Inspect the corresponding TypeScript component, services, models/interfaces, API integration, and existing container functionality before making changes.

The current **Containers** button/control must be replaced with a transport-category control.

The transport categories are:

- Sea Freight
- Air Freight

---

# 7. Exact Position of Transport Control

The transport-category control must be placed:

**below:**

```html
<!-- HEADER -->
```

and **above:**

```html
<!-- AGENT TABS -->
```

The structure should conceptually be:

```html
<!-- HEADER -->

<!-- TRANSPORT CATEGORY -->
[ Sea Freight ] [ Air Freight ]

<!-- AGENT TABS -->
```

Do not place the transport switcher inside the existing Agent Tabs.

Do not remove or redesign the existing Agent Tabs unless required for the transport-specific behavior.

---

# 8. Transport Capability Rules

The transport selector must depend on the transport capabilities of the currently authenticated agent.

There are three possible cases.

## 8.1 Agent Supports Both

If the agent supports:

```text
Sea Freight + Air Freight
```

show a toggle/switcher:

```text
[ Sea Freight ] [ Air Freight ]
```

The agent can switch between both modes.

---

## 8.2 Agent Supports Only Sea Freight

If the agent supports only Sea Freight:

```text
Sea Freight
```

show only the Sea Freight dashboard content.

Do NOT show a meaningless toggle with an unavailable Air Freight option.

---

## 8.3 Agent Supports Only Air Freight

If the agent supports only Air Freight:

```text
Air Freight
```

show only the Air Freight dashboard content.

Do NOT show a meaningless toggle with an unavailable Sea Freight option.

---

## 8.4 Do Not Hard-Code Capabilities

Determine the agent's available transport types using the existing authenticated-agent data/API/model.

Do not assume every agent supports both.

Do not create fake/static transport capability data.

If the current backend response already contains the required information, reuse it.

If the existing API genuinely does not expose enough information to determine this, identify the exact missing data before changing the backend.

Do not make unnecessary backend changes.

---

# 9. Sea Freight Mode

When Sea Freight is selected, preserve the existing Sea Freight functionality.

Use the existing terminology:

```text
Sea Freight
Container
Port
```

The current container functionality must continue to work.

Do not break:

- Container creation
- Container listing
- Container management
- Shipment assignment
- Status updates
- Search/filter
- Pagination/infinite scrolling
- Existing actions
- Existing API integration
- Existing navigation
- Existing dialogs/modals
- Existing validation

Only introduce the transport selector and the required transport-mode handling.

---

# 10. Air Freight Mode

When Air Freight is selected, provide equivalent functionality to the existing Sea Freight container workflow.

The primary terminology changes are:

```text
Sea Freight → Air Freight

Container → Batch

Port → Airport
```

Therefore, when Air Freight is active, the UI must use:

```text
Batch
Airport
```

instead of:

```text
Container
Port
```

---

# 11. Air Freight Batch Functionality

The existing Sea Freight container functionality should serve as the functional baseline for Air Freight.

If Sea Freight currently supports operations such as:

```text
Create Container
View Container
Manage Container
Assign Shipment
Update Status
Track
Search
Filter
```

Air Freight should provide the equivalent operations using Batch terminology:

```text
Create Batch
View Batch
Manage Batch
Assign Shipment
Update Status
Track
Search
Filter
```

Do not unnecessarily duplicate large amounts of code.

Prefer reusable components, functions, services, and shared logic where appropriate.

The underlying business behavior should remain equivalent unless the existing backend/domain model specifically requires a different implementation.

---

# 12. Air Freight Location Terminology

When Air Freight is active, replace relevant Port terminology with Airport terminology.

Examples:

```text
Departure Port
```

becomes:

```text
Departure Airport
```

and:

```text
Arrival Port
```

becomes:

```text
Arrival Airport
```

Likewise, any relevant user-facing label that represents the sea-freight port concept should use the equivalent airport terminology in Air Freight mode.

Do NOT change Sea Freight terminology.

---

# 13. No Mixed Transport Terminology

The active transport mode must determine the terminology shown to the user.

### Sea Freight

```text
Sea Freight
Container
Port
```

### Air Freight

```text
Air Freight
Batch
Airport
```

When Air Freight is selected, do not leave Sea Freight terminology in the Air Freight interface.

For example, avoid:

```text
Create Container
Container Details
Port
```

while Air Freight is active.

Use:

```text
Create Batch
Batch Details
Airport
```

Similarly, do not replace Sea Freight terminology globally. The Sea Freight interface must continue using Container and Port.

---

# 14. Transport Data Isolation

Transport switching must not mix Sea Freight and Air Freight data.

When Sea Freight is active:

```text
Show Sea Freight data
Show Containers
Use Port terminology
```

When Air Freight is active:

```text
Show Air Freight data
Show Batches
Use Airport terminology
```

Do not display a Sea Freight container in the Air Freight batch view.

Do not display an Air Freight batch in the Sea Freight container view.

Use the appropriate existing API/filter/query parameters and data models where available.

Do not simply rename UI labels while displaying the wrong underlying transport data.

---

# 15. Default Transport Mode

If the agent supports both transport types, select a sensible default transport mode based on the existing application behavior/data.

Do not introduce a random default.

If the existing application has a natural/default transport preference, preserve it.

If no existing preference exists, use a deterministic default and keep it consistent.

Most importantly, the initial selected mode must match the data shown underneath it.

---

# 16. Reuse Existing Architecture

Before implementing the changes, inspect:

- `qr-generator.html`
- QR Generator `.ts`
- QR Generator services
- QR/product models/interfaces
- PDF-generation utilities/services
- `my-products.html`
- My Products `.ts`
- My Products services
- Shipping `.html`
- Shipping `.ts`
- Shipping/container services
- Shipping/container models/interfaces
- Agent models
- Agent transport capability data
- Agent address data/API
- Existing transport-related code

Do not make decisions based only on the HTML files.

---

# 17. Production-Quality Implementation Rules

Follow the existing Angular project architecture and conventions.

Requirements:

- Use strong TypeScript typing.
- Avoid `any` unless unavoidable at an external boundary.
- Reuse existing services and models.
- Avoid unnecessary dependencies.
- Avoid duplicated business logic.
- Preserve existing Tailwind/design conventions.
- Preserve responsive behavior.
- Preserve existing accessibility behavior where applicable.
- Handle loading states correctly.
- Handle empty states correctly.
- Handle API errors correctly.
- Do not silently swallow errors.
- Prevent invalid transport/agent/address selections.
- Avoid memory leaks.
- Follow the project's existing Angular reactive/state-management approach.
- Do not introduce unnecessary architectural changes.

---

# 18. Important: Do Not Modify Unrelated Functionality

This task is an enhancement, not a rewrite.

Do NOT:

- Redesign unrelated pages.
- Rewrite existing working services unnecessarily.
- Remove existing product fields.
- Remove existing product UI.
- Change database structure unnecessarily.
- Change API contracts unnecessarily.
- Remove existing agent functionality.
- Remove existing shipment functionality.
- Remove existing container functionality.
- Replace existing business logic merely for stylistic reasons.
- Introduce mock data.
- Hard-code production business data.
- Add temporary debugging code.
- Leave `console.log()` debugging statements.
- Leave commented-out experimental implementations.

---

# 19. Acceptance Criteria — QR Assignment

The implementation passes this section only if all are true:

- [ ] User chooses Air Freight or Sea Freight first.
- [ ] Agent selection is compatible with the selected transport.
- [ ] Address selection is filtered by both selected agent and selected transport.
- [ ] Exactly one applicable address is automatically selected.
- [ ] Multiple applicable addresses require user selection.
- [ ] Changing transport revalidates dependent agent/address selections.
- [ ] Invalid agent/address combinations cannot be submitted.
- [ ] Existing QR Generator functionality remains intact.

---

# 20. Acceptance Criteria — PDF

- [ ] QR Generator PDF contains Product Name.
- [ ] QR Generator PDF contains Package Type.
- [ ] QR Generator PDF contains Quantity.
- [ ] QR Generator PDF does not contain Description.
- [ ] QR Generator PDF does not contain Total Weight.
- [ ] QR Generator PDF does not contain Volume.
- [ ] My Products PDF contains Product Name.
- [ ] My Products PDF contains Package Type.
- [ ] My Products PDF contains Quantity.
- [ ] My Products PDF does not contain Description.
- [ ] My Products PDF does not contain Total Weight.
- [ ] My Products PDF does not contain Volume.
- [ ] Description remains available in the UI.
- [ ] Total Weight remains available in the UI.
- [ ] Volume remains available in the UI.
- [ ] Existing product models/interfaces remain intact.
- [ ] Existing API data remains intact.
- [ ] Existing product forms and functionality remain intact.
- [ ] Existing product information is not deleted or hidden.

### Critical PDF verification

Verify the actual generated PDF output, not merely the source code.

The requirement is:

```text
APPLICATION DATA = unchanged

PDF OUTPUT = Product Name + Package Type + Quantity only
```

---

# 21. Acceptance Criteria — Agent Dashboard

- [ ] Existing Containers control is replaced by the transport category control.
- [ ] Transport control is positioned between `<!-- HEADER -->` and `<!-- AGENT TABS -->`.
- [ ] Agent supporting both modes can switch between Sea Freight and Air Freight.
- [ ] Agent supporting only Sea Freight sees Sea Freight without an unnecessary toggle.
- [ ] Agent supporting only Air Freight sees Air Freight without an unnecessary toggle.
- [ ] Sea Freight continues to use Container terminology.
- [ ] Sea Freight continues to use Port terminology.
- [ ] Air Freight uses Batch terminology.
- [ ] Air Freight uses Airport terminology.
- [ ] Air Freight provides equivalent functionality to the existing container workflow.
- [ ] Sea Freight functionality remains intact.
- [ ] Sea Freight data does not appear in Air Freight mode.
- [ ] Air Freight data does not appear in Sea Freight mode.
- [ ] Switching transport does not corrupt or incorrectly reuse state.
- [ ] Existing Agent Tabs continue to work.
- [ ] Existing shipment functionality continues to work.

---

# 22. Validation and Build

After implementation:

1. Run the project's available lint checks.
2. Run TypeScript/template validation.
3. Run the Angular production build.
4. Fix all compilation/template/type errors.
5. Test QR assignment with Air Freight.
6. Test QR assignment with Sea Freight.
7. Test an agent with exactly one applicable address.
8. Test an agent with multiple applicable addresses.
9. Change transport after selecting an agent/address and verify dependent state resets correctly.
10. Generate the QR PDF and inspect the actual PDF output.
11. Generate the My Products PDF and inspect the actual PDF output.
12. Confirm Description, Total Weight, and Volume remain available in the application UI.
13. Test an agent supporting both Sea and Air.
14. Test an agent supporting only Sea.
15. Test an agent supporting only Air.
16. Test Sea Freight container operations.
17. Test Air Freight batch operations.
18. Verify Port/Airport terminology.
19. Verify Container/Batch terminology.
20. Verify no cross-transport data leakage.

---

# 23. Final Implementation Principle

The final system should behave conceptually like this:

```text
                         PILIKA PILIKA
                              |
             +----------------+----------------+
             |                                 |
        QR / PRODUCTS                    AGENT DASHBOARD
             |                                 |
      Existing product data              Transport capability
             |                                 |
       KEEP EVERYTHING              +----------+----------+
             |                       |                     |
             |                  SEA FREIGHT           AIR FREIGHT
             |                       |                     |
             |                   Container                Batch
             |                       |                     |
             |                     Port                  Airport
             |
             ↓
       PDF GENERATION
             |
             +-----------------------+
             |                       |
       Product Name            Package Type
             |
          Quantity
```

## Most Important Rules

### Rule 1 — PDF only

The PDF requirement is **NOT** a data-removal requirement.

Keep all existing product information, UI, forms, models, APIs, state, and functionality intact.

Only filter the fields when generating the PDF.

### Rule 2 — Assignment dependency

The QR assignment flow must be:

```text
Transport Method → Agent → Transport-specific Address
```

### Rule 3 — Address behavior

```text
1 valid address  → auto-select
2+ valid addresses → user selects
```

### Rule 4 — Transport dashboard

```text
Sea Freight → Container + Port
Air Freight → Batch + Airport
```

### Rule 5 — Agent capabilities

```text
Sea only → Sea content only
Air only → Air content only
Both → Sea/Air toggle
```

### Rule 6 — Preserve existing functionality

Do not break or unnecessarily rewrite existing Sea Freight, product management, QR generation, shipment management, or agent functionality.

Implement the requested improvements within the existing architecture and verify the actual runtime behavior before considering the task complete.
