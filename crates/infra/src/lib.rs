//! lib.rs — Infra crate : adaptateurs des ports hexagonaux du domain.
//!
//! Structure :
//!   fs.rs          — utilitaire filesystem partagé entre les adaptateurs
//!   graph/         — adaptateur GraphRepository (InMemoryGraphRepository)
//!     mod.rs       — implémentation
//!     serializer.rs— JSON ↔ Node/Graph
//!   kind/          — adaptateur KindRepository (FileKindRepository)
//!     mod.rs       — implémentation + sérialisation JSON KindDef

pub mod fs;
pub mod graph;
pub mod kind;

pub use fs::WorkspaceFs;
pub use graph::InMemoryGraphRepository;
pub use kind::FileKindRepository;
