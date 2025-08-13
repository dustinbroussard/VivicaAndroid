package com.my.vivica;

import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.view.View;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    Window window = getWindow();

    // Set status bar color from our theme
    int statusBarColor = ContextCompat.getColor(this, R.color.status_bar_color);
    window.setStatusBarColor(statusBarColor);

    // Check if the status bar color is light and adjust text color accordingly
    if (isColorLight(statusBarColor)) {
      // For light status bar, make icons dark
      window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
    } else {
      // For dark status bar, clear any light status bar flag
      window.getDecorView().setSystemUiVisibility(0);
    }
  }

  /**
   * Determines if a color is light or dark based on luminance
   */
  private boolean isColorLight(int color) {
    int red = (color >> 16) & 0xFF;
    int green = (color >> 8) & 0xFF;
    int blue = color & 0xFF;
    
    // Calculate luminance using standard formula
    double luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
    
    // If luminance is > 0.5, it's a light color
    return luminance > 0.5;
  }
}
