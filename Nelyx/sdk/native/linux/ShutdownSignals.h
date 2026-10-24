// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <gtk/gtk.h>
#include <glib-unix.h>
#include <csignal>
/** Request ordinary GTK close on the UI loop, including signals received before activation finishes. */
class NelyxShutdownSignals final {
public:
  NelyxShutdownSignals(){interrupt=g_unix_signal_add(SIGINT,request,this);terminate=g_unix_signal_add(SIGTERM,request,this);}
  ~NelyxShutdownSignals(){if(interrupt)g_source_remove(interrupt);if(terminate)g_source_remove(terminate);if(pending)g_source_remove(pending);}
private:
  static gboolean request(gpointer data){auto& self=*static_cast<NelyxShutdownSignals*>(data);if(!self.pending)self.pending=g_timeout_add(50,close,data);return G_SOURCE_CONTINUE;}
  static gboolean close(gpointer data){auto& self=*static_cast<NelyxShutdownSignals*>(data);auto* app=g_application_get_default();auto* windows=app&&GTK_IS_APPLICATION(app)?gtk_application_get_windows(GTK_APPLICATION(app)):nullptr;if(!windows)return G_SOURCE_CONTINUE;self.pending=0;gtk_window_close(GTK_WINDOW(windows->data));return G_SOURCE_REMOVE;}
  guint interrupt=0,terminate=0,pending=0;
};
