package com.my.vivica;

import android.os.Bundle;
import android.view.Window;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.ColorUtils;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Set an initial status bar color. The web app updates this dynamically
    // to match the active theme via the Capacitor StatusBar plugin.
    Window window = getWindow();
    int statusBarColor = ContextCompat.getColor(this, R.color.status_bar_color);
    window.setStatusBarColor(statusBarColor);

    // Ensure status bar icons contrast against the background color
    WindowInsetsControllerCompat controller =
        new WindowInsetsControllerCompat(window, window.getDecorView());
    boolean isLight = ColorUtils.calculateLuminance(statusBarColor) > 0.5;
    controller.setAppearanceLightStatusBars(isLight);
  }
}
