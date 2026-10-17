# CARDIA Physiology Knowledge Base

> Purpose: Evidence base for CARDIA's Retrieval-Augmented Generation (RAG) explanation system.
>
> Scope: Cardiovascular physiology and anatomy relevant to the current CARDIA heart simulation.
>
> Important system rule: This document describes physiology. The RAG/LLM layer must never modify the simulation state. Live numerical values come from the simulation engine.

---

# 1. CARDIA Simulation Variables

CARDIA's current heart simulation exposes the following state variables:

* `time`
* `heart_rate`
* `systolic_bp`
* `diastolic_bp`
* `map`
* `cardiac_output`
* `stroke_volume`
* `edv`
* `esv`
* `lv_pressure`
* `aortic_pressure`
* `blood_volume`
* `contractility`
* `svr`
* `valves.mitral`
* `valves.aortic`
* `valves.tricuspid`
* `valves.pulmonary`

The RAG system may use these values as observations from the simulation.

The RAG system must not invent additional simulation variables and must not change these values.

---

# 2. Heart Rate

## Definition

Heart rate (HR) is the number of heartbeats occurring per minute.

Heart rate is normally initiated by spontaneous electrical activity of pacemaker cells in the sinoatrial (SA) node.

## CARDIA Variable

CARDIA represents heart rate using:

`heart_rate`

The value is interpreted as beats per minute (bpm).

## Physiological Relationship

Heart rate is one of the two primary determinants of cardiac output:

`Cardiac Output = Heart Rate × Stroke Volume`

An increase in heart rate can increase cardiac output when stroke volume is maintained, although very large increases in heart rate can reduce ventricular filling time.

## Evidence

NCBI Bookshelf describes the SA node as the primary pacemaker and identifies heart rate as a determinant of cardiac output.

---

# 3. Stroke Volume

## Definition

Stroke volume (SV) is the volume of blood ejected by a ventricle during one cardiac contraction.

## Equation

`SV = EDV - ESV`

where:

* `EDV` = end-diastolic volume
* `ESV` = end-systolic volume

## CARDIA Variables

CARDIA represents stroke volume using:

`stroke_volume`

The simulation also exposes:

`edv`

and

`esv`

## Physiological Relationship

For a given heart rate, a reduction in stroke volume tends to reduce cardiac output.

Stroke volume is influenced by ventricular filling, resistance against which the ventricle ejects, and myocardial contractility.

---

# 4. Cardiac Output

## Definition

Cardiac output (CO) is the volume of blood pumped by a ventricle per unit time.

## Equation

`CO = HR × SV`

where:

* `CO` = cardiac output
* `HR` = heart rate
* `SV` = stroke volume

## CARDIA Variables

CARDIA exposes:

`cardiac_output`

`heart_rate`

`stroke_volume`

## Diagnostic Reasoning

When CARDIA is asked:

"Why did cardiac output fall?"

the RAG system should inspect the current simulation state and determine whether the observed change is associated with:

* reduced heart rate,
* reduced stroke volume,
* reduced EDV,
* increased ESV,
* or another state change supported by retrieved physiological evidence.

The explanation must distinguish between an observed simulation value and a physiological mechanism supported by retrieved evidence.

## Important Grounding Rule

The LLM must not invent a cause merely because it sounds physiologically plausible.

If the simulation state does not contain enough information to establish a cause, the answer should explicitly state that the available state is insufficient to determine the cause.

---

# 5. End-Diastolic Volume

## Definition

End-diastolic volume (EDV) is the volume of blood in a ventricle at the end of ventricular filling, immediately before ventricular contraction.

## CARDIA Variable

`edv`

## Relationship With Stroke Volume

Stroke volume can be represented as:

`SV = EDV - ESV`

Therefore, if EDV decreases while ESV remains unchanged, stroke volume decreases.

If EDV increases while other relevant factors remain unchanged, stroke volume can increase.

## CARDIA Interpretation

EDV should be treated as an observed simulation value.

The RAG system should not assume why EDV changed unless the simulation provides sufficient information or the retrieved evidence supports the proposed mechanism.

---

# 6. End-Systolic Volume

## Definition

End-systolic volume (ESV) is the volume of blood remaining in a ventricle after ventricular contraction and ejection.

## CARDIA Variable

`esv`

## Relationship With Stroke Volume

`SV = EDV - ESV`

An increase in ESV, with EDV unchanged, decreases stroke volume.

A decrease in ESV, with EDV unchanged, increases stroke volume.

## Relationship With Contractility

In general cardiovascular physiology, increased ventricular contractility can increase ejection and reduce end-systolic volume, while reduced contractility can impair ventricular ejection and increase end-systolic volume.

The CARDIA RAG system must not claim that contractility caused a particular ESV change unless the live simulation state and retrieved evidence support that interpretation.

---

# 7. Cardiac Conduction System

## Overview

The cardiac conduction system generates and distributes electrical signals that coordinate atrial and ventricular contraction.

The major pathway represented in CARDIA is:

`SA Node → AV Node → Bundle of His → Right/Left Bundle Branches → Purkinje Fibers`

This electrical sequence coordinates activation of the atria and ventricles.

---

# 8. SA Node

## Definition

The sinoatrial (SA) node is a group of specialized cells located in the upper region of the right atrium.

It normally acts as the primary pacemaker of the heart.

## Function

The SA node spontaneously generates electrical impulses that initiate normal sinus rhythm.

The electrical signal spreads through the atrial myocardium and subsequently reaches the AV node.

## CARDIA Relevance

The SA node is a primary component of the interactive conduction-system visualization.

A hypothetical failure of the SA node should be explained as a disruption of the normal pacemaker source.

The RAG system must distinguish between:

* what is physiologically established,
* what is hypothetical,
* and what the current CARDIA simulation actually models.

---

# 9. AV Node

## Definition

The atrioventricular (AV) node is specialized conduction tissue located near the junction between the atria and ventricles.

## Function

The AV node receives the electrical signal from the atria and conducts it toward the ventricles through the His-Purkinje system.

AV nodal conduction introduces a delay between atrial and ventricular activation.

This delay helps allow ventricular filling before ventricular contraction.

## Backup Pacemaker

The AV node can also provide pacemaker activity under some conditions when normal SA-node activity fails.

Its intrinsic pacemaker rate is slower than the normal SA-node rate.

## "What If the AV Node Stops Working?"

A complete loss of normal AV nodal conduction would disrupt normal electrical transmission from the atria to the ventricles.

The physiological consequence depends on the exact type and severity of conduction disturbance and whether another pacemaker site takes over.

The RAG system must not claim a specific heart rate or blood-pressure outcome unless that outcome is represented by the CARDIA simulation or supported by retrieved evidence.

---

# 10. Bundle of His

## Definition

The bundle of His, also called the atrioventricular bundle, is specialized conduction tissue that carries electrical impulses from the AV node into the ventricular conduction system.

## Pathway

The pathway continues from:

`AV Node → Bundle of His → Right/Left Bundle Branches → Purkinje Fibers`

## Function

The bundle of His provides the electrical connection between the AV node and the ventricular conduction system.

Disruption of conduction through this pathway can interfere with coordinated ventricular activation.

---

# 11. Purkinje Fibers

## Definition

Purkinje fibers are specialized conducting fibers distributed throughout the ventricles.

## Function

They rapidly distribute electrical activation through the ventricular myocardium.

This coordinated activation allows the ventricles to contract in an organized manner.

## CARDIA Relevance

Purkinje fibers are part of the 3D conduction-system visualization.

A hypothetical disruption should be described as impaired ventricular electrical activation rather than as an automatically predetermined change in a specific CARDIA variable.

---

# 12. Cardiac Valves

## Overview

The four major heart valves control the direction of blood flow through the heart.

CARDIA represents four valve states:

* `mitral`
* `aortic`
* `tricuspid`
* `pulmonary`

The simulation provides these values as Boolean states.

## Important CARDIA Rule

The RAG layer must interpret valve states exactly as provided by the simulation engine.

It must not silently flip, correct, or modify a valve state.

---

# 13. Mitral Valve

## Location

The mitral valve lies between the left atrium and left ventricle.

## Function

It permits blood to flow from the left atrium into the left ventricle during ventricular filling.

It normally prevents backward flow from the left ventricle into the left atrium during ventricular contraction.

## CARDIA Variable

`valves.mitral`

---

# 14. Aortic Valve

## Location

The aortic valve lies between the left ventricle and the aorta.

## Function

It permits blood to leave the left ventricle and enter the aorta during ventricular ejection.

It prevents backward flow from the aorta into the left ventricle when the ventricle relaxes.

## CARDIA Variable

`valves.aortic`

---

# 15. Tricuspid Valve

## Location

The tricuspid valve lies between the right atrium and right ventricle.

## Function

It permits blood to flow from the right atrium into the right ventricle during ventricular filling.

It helps prevent backward flow from the right ventricle into the right atrium during ventricular contraction.

## CARDIA Variable

`valves.tricuspid`

---

# 16. Pulmonary Valve

## Location

The pulmonary valve lies between the right ventricle and pulmonary artery.

## Function

It permits blood to leave the right ventricle toward the pulmonary circulation during ventricular ejection.

It prevents backward flow from the pulmonary artery into the right ventricle during ventricular relaxation.

## CARDIA Variable

`valves.pulmonary`

---

# 17. Blood Pressure

## Systolic Blood Pressure

Systolic blood pressure (SBP) is the peak arterial pressure associated with ventricular systole.

## Diastolic Blood Pressure

Diastolic blood pressure (DBP) is the lower arterial pressure associated with ventricular diastole.

## CARDIA Variables

`systolic_bp`

`diastolic_bp`

---

# 18. Mean Arterial Pressure

## Definition

Mean arterial pressure (MAP) represents an approximation of the average arterial pressure during a cardiac cycle.

## Common Approximation

For normal resting heart rates:

`MAP ≈ DBP + 1/3(SBP - DBP)`

Equivalent form:

`MAP ≈ (SBP + 2 × DBP) / 3`

## CARDIA Variable

`map`

## Grounding Rule

If CARDIA provides `map` directly, the RAG system should treat that value as the simulation's observed MAP.

It should not overwrite the simulation value with a newly calculated value unless the application explicitly requests a calculation.

---

# 19. Systemic Vascular Resistance

## Definition

Systemic vascular resistance (SVR), also called systemic vascular resistance/total peripheral resistance in related contexts, represents resistance to blood flow through the systemic circulation.

## CARDIA Variable

`svr`

## Physiological Relationship

SVR contributes to the pressure-flow relationship of the systemic circulation.

Changes in systemic vascular resistance can influence arterial pressure and the workload against which the left ventricle ejects.

## CARDIA Grounding Rule

The exact numerical meaning and scaling of the CARDIA `svr` variable are defined by the simulation engine.

The RAG layer must not assume an undocumented unit or normalization.

---

# 20. Left Ventricular Pressure

## Definition

Left ventricular pressure is the pressure generated within the left ventricle during the cardiac cycle.

## CARDIA Variable

`lv_pressure`

## Physiological Relationship

Left ventricular pressure changes during filling, contraction, and ejection.

During ventricular systole, pressure generated by the left ventricle allows the aortic valve to open when ventricular pressure exceeds aortic pressure.

The exact simulated valve transition is determined by CARDIA's simulation engine.

---

# 21. Aortic Pressure

## Definition

Aortic pressure is the pressure within the aorta.

## CARDIA Variable

`aortic_pressure`

## Physiological Relationship

The pressure relationship between the left ventricle and aorta is important for aortic-valve opening and ventricular ejection.

The RAG system should use the live simulation values when explaining the current state.

---

# 22. Contractility

## Definition

Contractility describes the intrinsic ability of cardiac muscle to generate force during contraction, independent of changes in loading conditions.

## CARDIA Variable

`contractility`

## Physiological Relationship

Increased contractility can increase ventricular force generation and can increase ejection under appropriate conditions.

Reduced contractility can impair ventricular ejection.

The precise numerical scale of CARDIA's `contractility` variable is defined by the simulation engine.

The RAG system must not invent units for this variable.

---

# 23. Blood Volume

## Definition

Blood volume is the volume of blood contained within the cardiovascular system.

## CARDIA Variable

`blood_volume`

## CARDIA Grounding Rule

The RAG layer should treat `blood_volume` as an observed simulation variable.

A change in blood volume may influence cardiovascular filling and pressure, but the RAG system must not infer a specific mechanism without sufficient evidence from the simulation and retrieved physiology.

---

# 24. Cardiac Cycle

## Overview

The cardiac cycle consists of alternating periods of ventricular filling and contraction.

A simplified sequence is:

1. Ventricular filling
2. Ventricular contraction
3. Ventricular ejection
4. Ventricular relaxation

Valve states change during the cardiac cycle to maintain directional blood flow.

## CARDIA Relevance

The live simulation exposes valve states and pressure variables that can be used to explain the current simulated phase.

The RAG system should describe the observed state rather than inventing an unseen cardiac phase.

---

# 25. Cause-and-Effect Reasoning Rules

CARDIA explanations should follow this hierarchy:

1. Identify what changed in the live SimulationState.
2. Retrieve relevant physiological evidence.
3. Connect the observed change to a supported physiological mechanism.
4. Clearly distinguish observation from inference.
5. State uncertainty when the available state is insufficient.
6. Never invent missing measurements.
7. Never modify the simulation state.

## Example

If:

`cardiac_output` decreases

and:

`stroke_volume` also decreases

while:

`heart_rate` remains approximately unchanged,

a supported explanation may identify the reduction in stroke volume as a contributor to the reduction in cardiac output because:

`CO = HR × SV`

The system should not automatically claim that preload, afterload, contractility, or a valve abnormality caused the stroke-volume change unless the available state and retrieved evidence support that claim.

---

# 26. Current CARDIA Baseline State

The current example state supplied by the CARDIA simulation team is:

* `time`: 12.42
* `heart_rate`: 82
* `systolic_bp`: 118
* `diastolic_bp`: 76
* `map`: 90
* `cardiac_output`: 5.2
* `stroke_volume`: 63
* `edv`: 128
* `esv`: 65
* `lv_pressure`: 115
* `aortic_pressure`: 90
* `blood_volume`: 100
* `contractility`: 100
* `svr`: 100

Valve state:

* `mitral`: false
* `aortic`: true
* `tricuspid`: false
* `pulmonary`: true

These values are an example/current simulation state, not universal physiological reference values.

The RAG system must use live SimulationState values supplied at query time rather than treating this example state as permanently current.

---

# 27. Evidence Sources

The initial physiology content is based on established cardiovascular physiology references, primarily NCBI Bookshelf resources:

* NCBI Bookshelf — In brief: How is the heart rhythm regulated?
* NCBI Bookshelf — Physiology, Cardiac
* NCBI Bookshelf — Physiology, Cardiac Output
* NCBI Bookshelf — Physiology, Cardiovascular
* NCBI Bookshelf — Blood Pressure Measurement
* NCBI Bookshelf — Physiology, AV Junction
* NCBI Bookshelf — Physiology, Bundle of His

These sources should be retained as provenance references when the knowledge base is expanded.

---

# 28. RAG Safety Rules

The RAG system must follow these rules:

* Retrieved evidence is the grounding source for physiological claims.
* The LLM must not fabricate citations.
* The LLM must not invent measurements.
* The LLM must not modify SimulationState.
* The LLM must not treat a hypothetical "What If" scenario as an observed event.
* The LLM must distinguish simulation observations from physiological explanations.
* If evidence is insufficient, the system must say so.
* If retrieval confidence is low, the system must not bluff.
* Current simulation values always come from the simulation engine.
* The knowledge base describes physiology; it does not control the simulation.

---

# 29. Source Provenance

Source type: Curated physiology knowledge base

Primary reference collection: NCBI Bookshelf / National Library of Medicine

Intended use: Educational hackathon demonstration and evidence-grounded explanations inside CARDIA.

This knowledge base is not a clinical diagnostic system and should not be used as a substitute for professional medical advice.
