package com.my.vivica;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  private void applyNativeStatusBarTheme() {
    Window window = getWindow();
    if (window == null) return;

    boolean isNight = (getResources().getConfiguration().uiMode &
      Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;

    // Background color: black in dark mode, white in light mode
    window.setStatusBarColor(isNight ? Color.BLACK : Color.WHITE);

    // Icon color: dark icons on light background; light icons on dark background
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      View decor = window.getDecorView();
      int flags = decor.getSystemUiVisibility();
      if (isNight) {
        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; // light icons
      } else {
        flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;  // dark icons
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
