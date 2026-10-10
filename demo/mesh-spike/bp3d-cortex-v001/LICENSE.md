# BodyParts3D anatomy: licence and attribution

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International

The current Femur outer surface and derived core are distributed in reliance on the publisher’s **CC BY 4.0** grant, not the project’s MIT code licence. The official [publisher licence](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), updated 2025/02/27, explicitly permits redistribution and derivative works subject to attribution. The [publisher README](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/README_e.html) also specifies CC BY 4.0 in its licence text. Retain the credit above, the source and licence links, and an indication of changes when redistributing these adaptations. Consult the [CC BY 4.0 terms](https://creativecommons.org/licenses/by/4.0/) for the full conditions.

## Source and changes

Selected source: BodyParts3D release 4.0, left femur FMA24475 / FJ3259; member `partof_BP3D_4.0_obj_99/FJ3259.obj` of the [official archive](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip).

Parallax changes: exact welding of coincident vertex indices without changing the outer triangle geometry; an authored inward-offset core with unchanged connectivity; runtime translation of both boundaries by subtracting `[91.10159999999999,-80.8791,744.239]`. No source rotation, scaling or cropping. The whole bone is retained. The core is illustrative, not a recovered tissue segmentation. These adaptations are not endorsed or anatomically validated by the publisher.

## Retained historical discrepancy

The original OBJ header says **CC Attribution-Share Alike 2.1 Japan**; those comments remain in the derived OBJ files. The current README’s licence text says CC BY 4.0 but still has an old BY-SA 2.1 Japan summary link. We rely on the current, explicit publisher licence page rather than silently replacing or concealing these older notices. This is the distribution’s licence interpretation, not legal certification or a claim that every historical notice has been reconciled.

Original code, primitive teaching assets and historical procedural v001 remain under MIT. That grant does not relicense the imported anatomy or its core derivative.
