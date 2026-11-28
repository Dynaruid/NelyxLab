// SPDX-License-Identifier: BSD-3-Clause
use nelyx_skia_foreground::FrameKey;
use serde::{Deserialize, Serialize};

pub const MAX_ID: u64 = (1 << 53) - 1;
pub const MAX_VIEWS: usize = 8;
pub const MAX_REGIONS: usize = 128;
pub const HOST_WIRE_VERSION: u32 = 1;

#[derive(Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Owner {
    pub id: String,
    pub generation: u64,
}

#[derive(Deserialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Command {
    Probe,
    Open {
        owner: Owner,
    },
    Create {
        owner: Owner,
        instance_id: u64,
        view_type: String,
        text: String,
    },
    Update {
        owner: Owner,
        instance_id: u64,
        text: String,
    },
    Remove {
        owner: Owner,
        instance_id: u64,
    },
    Focus {
        owner: Owner,
        instance_id: Option<u64>,
    },
    Hide {
        owner: Owner,
        through: u64,
    },
    Close {
        owner: Owner,
    },
}

impl Command {
    pub fn owner(&self) -> Result<&Owner, String> {
        let owner = match self {
            Self::Open { owner }
            | Self::Create { owner, .. }
            | Self::Update { owner, .. }
            | Self::Remove { owner, .. }
            | Self::Focus { owner, .. }
            | Self::Hide { owner, .. }
            | Self::Close { owner } => owner,
            Self::Probe => unreachable!("Probe does not have a view owner"),
        };
        if !id(owner.generation) || owner.id.is_empty() || owner.id.len() > 80 {
            return Err("Invalid native view owner".into());
        }
        Ok(owner)
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Placement {
    pub instance_id: u64,
    pub bounds: Bounds,
    pub clip: Bounds,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Hit {
    pub instance_id: u64,
    pub rect: Bounds,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Frame {
    pub owner: Owner,
    pub sequence: u64,
    pub viewport_generation: u64,
    pub renderer_generation: u64,
    pub context_generation: u64,
    pub surface_generation: u64,
    pub origin: [f64; 2],
    pub scale: f64,
    pub width: i32,
    pub height: i32,
    pub placements: Vec<Placement>,
    pub input: Vec<Hit>,
}

impl Frame {
    pub fn key(&self) -> Result<FrameKey, String> {
        if !id(self.sequence)
            || !id(self.viewport_generation)
            || !id(self.renderer_generation)
            || self.context_generation > MAX_ID
            || self.surface_generation > MAX_ID
        {
            return Err("Invalid native frame identity".into());
        }
        Ok(FrameKey {
            owner_generation: self.owner.generation,
            sequence: self.sequence,
            viewport_generation: self.viewport_generation,
            renderer_generation: self.renderer_generation,
            context_generation: self.context_generation,
            surface_generation: self.surface_generation,
        })
    }

    pub fn is_stale(key: FrameKey, previous: Option<FrameKey>, hidden_through: u64) -> bool {
        key.sequence <= hidden_through
            || previous.is_some_and(|previous| {
                key.sequence <= previous.sequence
                    || key.viewport_generation < previous.viewport_generation
                    || key.renderer_generation < previous.renderer_generation
                    || key.context_generation < previous.context_generation
                    || key.surface_generation < previous.surface_generation
            })
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Pointer {
    pub kind: &'static str,
    pub sequence: u64,
    pub viewport_generation: u64,
    pub x: f64,
    pub y: f64,
    #[cfg(any(target_os = "ios", target_os = "macos"))]
    pub device: &'static str,
}

#[derive(Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ControlEvent {
    Input {
        instance_id: u64,
        value: String,
    },
    #[cfg(windows)]
    Click {
        instance_id: u64,
    },
    Tab {
        instance_id: u64,
        backwards: bool,
    },
    #[cfg(target_os = "ios")]
    Keyboard {
        instance_id: u64,
        bottom: f64,
    },
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum Event {
    Pointer(Pointer),
    Control(ControlEvent),
}

pub fn id(value: u64) -> bool {
    value > 0 && value <= MAX_ID
}

pub fn pixel(value: f64) -> Result<i32, String> {
    if !value.is_finite() || value.abs() > 65_536.0 {
        return Err("Invalid native view coordinate".into());
    }
    Ok(value.round() as i32)
}

pub fn parse_frame(bytes: &[u8]) -> Result<(Frame, &[u8]), String> {
    if bytes.len() < 8 || bytes.len() > 384 * 1024 {
        return Err("Invalid native frame packet size".into());
    }
    let version = u32::from_le_bytes(bytes[..4].try_into().unwrap());
    let length = u32::from_le_bytes(bytes[4..8].try_into().unwrap()) as usize;
    if version != HOST_WIRE_VERSION || length > bytes.len() - 8 || length > 64 * 1024 - 8 {
        return Err("Invalid native frame packet header".into());
    }
    let (metadata, commands) = bytes[8..].split_at(length);
    let frame = serde_json::from_slice(metadata).map_err(|error| error.to_string())?;
    Ok((frame, commands))
}
