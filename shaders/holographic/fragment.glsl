// =============================================================================
// HOLOGRAPHIC IRIDESCENT MATERIAL - FRAGMENT SHADER
// =============================================================================
// Physically-based iridescence with thin-film interference
// Optimized for real-time WebGL rendering
// =============================================================================

precision highp float;

// Uniforms
uniform float uTime;
uniform float uIridescenceIntensity;
uniform float uIridescenceSpeed;
uniform vec3 uViewPosition;
uniform vec3 uCameraPosition;
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// Varyings
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

// Constants
#define PI 3.14159265359
#define TAU 6.28318530718

// Spectral wavelengths (nm) for RGB
const vec3 WAVELENGTHS = vec3(650.0, 550.0, 450.0); // R, G, B in nm
const float IOR_AIR = 1.0;
const float IOR_FILM = 1.5; // Thin film IOR
const float FILM_THICKNESS = 400.0; // nm

// =============================================================================
// THIN-FILM INTERFERENCE
// =============================================================================

float thinFilmInterference(float cosTheta, float thickness, float ior) {
  // Optical path difference
  float phase = 2.0 * PI * thickness * ior * cosTheta / 550.0; // Normalized to green
  
  // Fresnel reflectance (Schlick's approximation)
  float R0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  float fresnel = R0 + (1.0 - R0) * pow(1.0 - cosTheta, 5.0);
  
  // Interference for RGB channels
  vec3 phases = phase * (550.0 / WAVELENGTHS);
  vec3 intensities = cos(phases) * 0.5 + 0.5;
  
  return dot(intensities, vec3(0.333)) * fresnel;
}

// =============================================================================
// HOLOGRAPHIC NOISE
// =============================================================================

vec3 hash33(vec3 p) {
  p = fract(p * 0.3183098861837907) * TAU;
  p = vec3(sin(p.x), sin(p.y), sin(p.z));
  return fract(p * 43758.5453123);
}

float noise3d(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = dot(hash33(i + vec3(0,0,0)), f);
  float b = dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0));
  float c = dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0));
  float d = dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0));
  float e = dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1));
  float f_ = dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1));
  float g = dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1));
  float h = dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1));
  
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
             mix(mix(e, f_, f.x), mix(g, h, f.x), f.y), f.z);
}

vec3 fbm3d(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * noise3d(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return vec3(value);
}

// =============================================================================
// VOLUMETRIC SCATTERING
// =============================================================================

float raymarchVolume(vec3 ro, vec3 rd, float maxDist, float density) {
  float t = 0.0;
  float accumulated = 0.0;
  vec3 pos = ro;
  
  for (int i = 0; i < 32; i++) {
    if (t >= maxDist) break;
    
    pos = ro + rd * t;
    float n = noise3d(pos * 0.5 + uTime * 0.1);
    float d = n * density;
    
    accumulated += d * (1.0 - accumulated) * 0.1;
    t += maxDist / 32.0;
    
    if (accumulated > 0.99) break;
  }
  
  return accumulated;
}

// =============================================================================
// MAIN
// =============================================================================

void main() {
  // Normalize vectors
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(uCameraPosition - vWorldPosition);
  vec3 L = normalize(vec3(0.5, 1.0, 0.3)); // Main light direction
  
  // View angle for iridescence
  float cosTheta = abs(dot(N, V));
  
  // Base holographic color from UV
  vec3 baseColor = vec3(0.0);
  
  // Prism gradient based on world position
  float prismAngle = atan(vWorldPosition.z, vWorldPosition.x) + uTime * uIridescenceSpeed;
  float prismValue = sin(prismAngle * 3.0 + vWorldPosition.y * 0.1) * 0.5 + 0.5;
  
  // Spectral color mapping
  vec3 prismColor = mix(
    mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.5), prismValue), // Cyan to Emerald
    mix(vec3(1.0, 0.84, 0.0), vec3(1.0, 0.42, 0.0), prismValue), // Gold to Orange
    step(0.5, fract(prismAngle / TAU))
  );
  
  // Thin-film interference
  float iridescence = thinFilmInterference(cosTheta, FILM_THICKNESS, IOR_FILM);
  vec3 iridescentColor = mix(
    vec3(0.0, 1.0, 1.0),  // Cyan
    vec3(0.74, 0.0, 1.0), // Violet
    iridescence
  );
  
  // Volumetric glow
  float viewDist = length(uCameraPosition - vWorldPosition);
  float volumetric = raymarchVolume(uCameraPosition, V, viewDist, 0.02) * 0.3;
  
  // Fresnel rim
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 rimColor = mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 0.84, 0.0), fresnel);
  
  // Combine layers
  vec3 color = vec3(0.0);
  color += prismColor * 0.3;
  color += iridescentColor * uIridescenceIntensity * 0.5;
  color += rimColor * fresnel * 0.4;
  color += vec3(volumetric) * vec3(0.0, 0.5, 1.0);
  
  // Add noise detail
  vec3 noise = fbm3d(vWorldPosition * 0.1 + uTime * 0.05, 3);
  color += noise * 0.05;
  
  // Gamma correction
  color = pow(color, vec3(1.0 / 2.2));
  
  // Alpha based on viewing angle (holographic transparency)
  float alpha = mix(0.3, 0.9, fresnel) * (1.0 - volumetric * 0.5);
  
  gl_FragColor = vec4(color, alpha);
}
