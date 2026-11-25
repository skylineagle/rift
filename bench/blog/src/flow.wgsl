struct Params {
  time: f32,
  aspect: f32,
  density: f32,
  loss: f32,
  speed: f32,
  heat: f32,
  background: vec3f,
  ink: vec3f,
  delivered: vec3f,
  dropped: vec3f,
}
@group(0) @binding(0) var<uniform> params: Params;

const LANES: i32 = 9;
const CELLS: f32 = 22.0;
const GATE: f32 = 0.5;
const RADIUS: f32 = 0.014;

fn hash(point: vec2f) -> f32 {
  return fract(sin(dot(point, vec2f(127.1, 311.7))) * 43758.5453);
}

fn dot_mask(distance: f32) -> f32 {
  return 1.0 - smoothstep(RADIUS * 0.55, RADIUS, distance);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var color = params.background;
  let band = smoothstep(0.30, 0.31, uv.y) * (1.0 - smoothstep(0.69, 0.70, uv.y));
  color = mix(color, mix(params.background, params.ink, 0.05), band);
  let rail = (1.0 - smoothstep(0.0, 0.003, abs(uv.y - 0.305))) + (1.0 - smoothstep(0.0, 0.003, abs(uv.y - 0.695)));
  color = mix(color, params.ink, rail * 0.18);

  let gateDistance = abs(uv.x - GATE) * params.aspect;
  let gateGlow = exp(-gateDistance * 40.0) * (0.25 + params.heat * 0.75) * band;
  let gateColor = mix(params.delivered, params.dropped, params.heat);
  color = mix(color, gateColor, clamp(gateGlow, 0.0, 0.85));

  for (var lane = 0; lane < LANES; lane = lane + 1) {
    let laneIndex = f32(lane);
    let laneY = mix(0.35, 0.65, (laneIndex + 0.5) / f32(LANES));
    let laneSpeed = params.speed * (0.85 + 0.3 * hash(vec2f(laneIndex, 3.1)));
    let scroll = params.time * laneSpeed * CELLS;
    let cellCoordinate = uv.x * CELLS - scroll;
    for (var offset = -1; offset <= 1; offset = offset + 1) {
      let cell = floor(cellCoordinate) + f32(offset);
      let seed = vec2f(cell, laneIndex);
      if (hash(seed) > params.density) {
        continue;
      }
      let particleX = (cell + 0.2 + 0.6 * hash(seed + 17.0) + scroll) / CELLS;
      let past = max(particleX - GATE, 0.0);
      let isDropped = past > 0.0 && hash(seed + 41.0) < params.loss;
      var particleY = laneY;
      var tint = params.ink;
      var strength = 0.9;
      if (isDropped) {
        particleY = laneY + past * past * 9.0;
        tint = params.dropped;
        strength = 0.95 * (1.0 - smoothstep(0.0, 0.35, past));
      } else if (past > 0.0) {
        tint = params.delivered;
      }
      let delta = vec2f((uv.x - particleX) * params.aspect, uv.y - particleY);
      color = mix(color, tint, dot_mask(length(delta)) * strength);
    }
  }
  return vec4f(color, 1.0);
}
