import * as THREE from 'three';

export const SketchShader = {
    uniforms: {
        color: { value: new THREE.Color(0xffffff) },
        lineColor: { value: new THREE.Color(0x333333) },
        time: { value: 0.0 },
        directionalLightDirection: { value: new THREE.Vector3(1, 1, 1).normalize() },
        directionalLightColor: { value: new THREE.Color(0xffffff) },
        ambientLightColor: { value: new THREE.Color(0x666666) },
        thickness: { value: 2.0 },
        spacing: { value: 8.0 }
    },

    vertexShader: `
    uniform float time;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    // A simple 3D noise function to displace vertices
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + .1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                     mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                     mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
    }

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,

    fragmentShader: `
    uniform vec3 color;
    uniform vec3 lineColor;
    uniform vec3 directionalLightDirection;
    uniform vec3 directionalLightColor;
    uniform vec3 ambientLightColor;
    
    uniform float thickness;
    uniform float spacing;

    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      
      // Approximate view-space light direction
      vec3 lightDir = normalize(directionalLightDirection);
      
      float nDotL = max(dot(normal, lightDir), 0.0);
      
      // Lighting intensity
      vec3 diffuse = directionalLightColor * nDotL;
      vec3 ambient = ambientLightColor;
      vec3 finalLight = diffuse + ambient;
      float intensity = dot(finalLight, vec3(0.299, 0.587, 0.114));
      
      // Screen coordinates for hatching
      vec2 fragCoord = gl_FragCoord.xy;
      
      float val = 1.0;
      float currentSpacing = spacing;
      
      // Layer 1
      if (intensity < 0.70) {
        if (mod(fragCoord.x + fragCoord.y, currentSpacing) < thickness) val = 0.0;
      }
      
      // Layer 2
      if (intensity < 0.50) {
        if (mod(fragCoord.x - fragCoord.y, currentSpacing) < thickness) val = 0.0;
      }
      
      // Layer 3
      if (intensity < 0.30) {
        if (mod(fragCoord.x + fragCoord.y - (currentSpacing/2.0), currentSpacing) < thickness) val = 0.0;
      }
      
      // Layer 4
      if (intensity < 0.15) {
        if (mod(fragCoord.x - fragCoord.y - (currentSpacing/2.0), currentSpacing) < thickness) val = 0.0;
      }
      
      vec3 finalColor = mix(lineColor, color * finalLight, val);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};
