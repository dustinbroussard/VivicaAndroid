package com.my.vivica;

import android.content.res.Configuration;
import android.os.Bundle;
import android.view.Window;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    applyStatusBarColor();
  }

  @Override
  protected void onResume() {
    super.onResume();
    applyStatusBarColor();
  }

  private void applyStatusBarColor() {
    Window window = getWindow();
    boolean isNight =
        (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
            == Configuration.UI_MODE_NIGHT_YES;
    int colorRes = isNight ? R.color.status_bar_dark : R.color.status_bar_light;
    int statusBarColor = ContextCompat.getColor(this, colorRes);
    window.setStatusBarColor(statusBarColor);

    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(window, window.getDecorView());
    controller.setAppearanceLightStatusBars(!isNight);
  }
}
