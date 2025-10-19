package com.my.vivica;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  private void applyNativeStatusBarTheme() {
    Window window = getWindow();
    if (window == null) return;

    boolean isNight = (getResources().getConfiguration().uiMode &
      Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;

    // Background color: black in dark mode, white in light mode
    window.setStatusBarColor(isNight ? Color.BLACK : Color.WHITE);
    window.setNavigationBarColor(isNight ? Color.BLACK : Color.WHITE);

    // Icon color: dark icons on light background; light icons on dark background
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { // API 30+
      WindowInsetsController controller = window.getInsetsController();
      if (controller != null) {
        if (isNight) {
          // Dark mode background: clear "light" flags to get light (white) icons/text
          controller.setSystemBarsAppearance(
            0,
            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        } else {
          // Light mode background: set "light" flags to get dark (black) icons/text
          controller.setSystemBarsAppearance(
            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        }
      }
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) { // API 23-29 (with nav bar support where available)
      View decor = window.getDecorView();
      int flags = decor.getSystemUiVisibility();
      if (isNight) {
        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; // light icons
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR; // light nav icons
        }
      } else {
        flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;  // dark icons
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR; // dark nav icons
        }
      }
      decor.setSystemUiVisibility(flags);
    }
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    applyNativeStatusBarTheme();
  }

  @Override
  public void onResume() {
    super.onResume();
    applyNativeStatusBarTheme();
  }
}
