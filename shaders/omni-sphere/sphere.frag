// =============================================================================
// OMNI-SPHERE HOLOGRAM - FRAGMENT SHADER
// =============================================================================
// Multi-ring holographic sphere with volumetric interior
// =============================================================================

precision highp float;

uniform float uTime;
uniform float uRotationSpeed;
uniform int uRingCount;
uniform float uGlowIntensity;
uniform vec3 uCameraPosition;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vRingIndex;

#define PI 3.14159265359
#define TAU 6.28318530718

// Spherical coordinates
vec3 cartesianToSpherical(vec3 p) {
  float r = length(p);
  float theta = acos(clamp(p.y / r, -1.0, 1.0));
  float phi = atan(p.z, p.x);
  return vec3(r, theta, phi);
}

// Ring pattern
float ringPattern(vec3 spherical, float ringIndex, float time) {
  float r = spherical.x;
  float theta = spherical.y;
  float phi = spherical.z;
  
  // Ring spacing
  float ringSpacing = 1.0 / float(uRingCount);
  float ringRadius = ringIndex * ringSpacing;
  float ringWidth = ringSpacing * 0.15;
  
  // Distance from ring
  float dist = abs(r - ringRadius) / ringWidth;
  
  // Animated rotation
  float rotation = phi + time * uRotationSpeed * (1.0 + ringIndex * 0.1);
  
  // Modulated ring
  float pattern = smoothstep(1.0, 0.0, dist) * 
                  (0.5 + 0.5 * sin(rotation * 8.0 + theta * 6.0));
  
  return pattern;
}

// Volumetric core
float volumetricCore(vec3 pos, float time) {
  vec3 spherical = cartesianToSpherical(pos);
  float r = spherical.x;
  
  // FBM noise for volumetric texture
  float n = 0.0;
  float amp = 1.0;
  float freq = 2.0;
  vec3 p = pos * 0.5;
  
  for (int i = 0; i < 4; i++) {
    n += amp * sin(p.x * freq + time) * sin(p.y * freq + time * 1.3) * sin(p.z * freq + time * 0.7);
    amp *= 0.5;
    freq *= 2.0;
    p *= 2.0;
  }
  
  // Spherical falloff
  float falloff = 1.0 - smoothstep(0.0, 1.0, r);
  
  return n * falloff * 0.5 + 0.5;
}

void main() {
  vec3 spherical = cartesianToSpherical(vWorldPosition);
  float r = spherical.x;
  
  // Normalize to sphere radius
  float normalizedR = r;
  
  // Accumulate rings
  float rings = 0.0;
  vec3 ringColor = vec3(0.0);
  
  for (int i = 0; i < 8; i++) {
    if (i >= uRingCount) break;
    
    float ring = ringPattern(spherical, float(i), uTime);
    rings += ring;
    
    // Color per ring
    float hue = float(i) / float(uRingCount) + uTime * 0.02;
    vec3 color = vec3(
      0.5 + 0.5 * sin(hue * TAU),
      0.5 + 0.5 * sin(hue * TAU + 2.094),
      0.5 + 0.5 * sin(hue * TAU + 4.188)
    );
    ringColor += color * ring;
  }
  
  // Volumetric interior
  float volume = volumetricCore(vWorldPosition, uTime);
  vec3 volumeColor = mix(
    vec3(0.0, 0.3, 0.5),
    vec3(0.5, 0.0, 0.5),
    volume
  );
  
  // Fresnel glow
  vec3 V = normalize(uCameraPosition - vWorldPosition);
  vec3 N = normalize(vNormal);
  float fresnel = pow(1.0 - abs(dot(N, V)), 2.0);
  vec3 fresnelColor = vec3(0.0, 1.0, 1.0) * fresnel * uGlowIntensity;
  
  // Combine
  vec3 color = vec3(0.0);
  color += ringColor * 0.8;
  color += volumeColor * volume * 0.3;
  color += fresnelColor;
  
  // Pulse animation
  float pulse = 0.8 + 0.2 * sin(uTime * 2.0);
  color *= pulse;
  
  // Alpha
  float alpha = clamp(rings * 0.5 + volume * 0.3 + fresnel * 0.5, 0.0, 1.0);
  
  gl_FragColor = vec4(color, alpha);
}
