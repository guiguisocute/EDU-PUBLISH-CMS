export function computeVarsFromHue(hue) {
  return {
    light: {
      '--primary': `${hue} 83% 53%`,
      '--primary-foreground': `${hue} 40% 98%`,
      '--secondary': `${hue} 40% 96%`,
      '--secondary-foreground': `${hue} 47% 11%`,
      '--accent': `${hue} 40% 96%`,
      '--accent-foreground': `${hue} 47% 11%`,
      '--foreground': `${hue} 47% 11%`,
      '--card-foreground': `${hue} 47% 11%`,
      '--popover-foreground': `${hue} 47% 11%`,
      '--muted': `${hue} 40% 96%`,
      '--muted-foreground': `${hue} 16% 47%`,
      '--border': `${hue} 32% 91%`,
      '--input': `${hue} 32% 91%`,
      '--ring': `${hue} 83% 53%`,
    },
    dark: {
      '--primary': `${hue} 91% 60%`,
      '--primary-foreground': `${hue} 47% 11%`,
      '--secondary': `${hue} 10% 18%`,
      '--secondary-foreground': `${hue} 40% 92%`,
      '--accent': `${hue} 10% 18%`,
      '--accent-foreground': `${hue} 40% 92%`,
      '--ring': `${hue} 91% 60%`,
    },
  };
}

export function applyHueVars(style, hue, isDark) {
  const vars = computeVarsFromHue(hue);
  const nextVars = isDark ? vars.dark : vars.light;
  const staleKeys = isDark
    ? Object.keys(vars.light).filter((key) => !(key in vars.dark))
    : [];

  for (const key of staleKeys) {
    style.removeProperty(key);
  }

  for (const [key, value] of Object.entries(nextVars)) {
    style.setProperty(key, value);
  }
}
