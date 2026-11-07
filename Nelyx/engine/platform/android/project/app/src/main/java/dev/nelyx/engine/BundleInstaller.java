// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.engine;
import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.util.HashSet;

/** One current extracted bundle. APK assets and the loaded native owner must agree. */
public final class BundleInstaller {
    private BundleInstaller() {}
    public static File install(Context context) throws Exception {
        JSONObject manifest;
        try(InputStream stream=context.getAssets().open("nelyx-bundle.json");ByteArrayOutputStream bytes=new ByteArrayOutputStream()){byte[] block=new byte[8192];int count;while((count=stream.read(block))>=0){if(bytes.size()+count>1024*1024)throw new IllegalArgumentException("Bundle index budget exceeded");bytes.write(block,0,count);}manifest=new JSONObject(bytes.toString("UTF-8"));}
        if(!manifest.getString("sourceSha256").equals(NativeHost.identity()))throw new IllegalStateException("Installed Android native/application identities differ");
        File root=new File(context.getFilesDir(),"v2-current");if(!root.isDirectory()&&!root.mkdirs())throw new IllegalStateException("Cannot create application asset directory");
        JSONArray files=manifest.getJSONArray("files");if(files.length()>1024)throw new IllegalArgumentException("Asset count budget exceeded");
        HashSet<String> current=new HashSet<>();
        for(int i=0;i<files.length();i++){
            JSONObject item=files.getJSONObject(i);String name=item.getString("path"),hash=item.getString("sha256");
            if(name.startsWith("/")||name.contains("\\")||name.contains(":"))throw new IllegalArgumentException("Invalid bundle asset path");
            File file=new File(root,name).getCanonicalFile();if(!file.toPath().startsWith(root.getCanonicalFile().toPath())||file.equals(root))throw new IllegalArgumentException("Asset path leaves application");
            if(!current.add(file.getCanonicalPath()))throw new IllegalArgumentException("Duplicate bundle asset");
            if(file.isFile()&&digest(new FileInputStream(file)).equals(hash))continue;
            File parent=file.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IllegalStateException("Cannot create asset parent");
            File pending=new File(parent,file.getName()+".pending");
            try {
                try(InputStream from=context.getAssets().open(name);FileOutputStream to=new FileOutputStream(pending)){byte[] block=new byte[65536];long total=0;int count;while((count=from.read(block))>=0){total+=count;if(total>64L*1024*1024)throw new IllegalArgumentException("Asset byte budget exceeded");to.write(block,0,count);}}
                if(!digest(new FileInputStream(pending)).equals(hash))throw new IllegalStateException("Installed bundle asset hash differs: "+name);
                if(!pending.renameTo(file))throw new IllegalStateException("Cannot publish current application asset");
            } finally { if(pending.exists()&&!pending.delete())throw new IllegalStateException("Cannot remove pending application asset"); }
        }
        prune(root,root.getCanonicalFile(),current);
        android.util.Log.i("NelyxV2","V2_ANDROID_IDENTITY "+manifest.getString("sourceSha256"));
        return root;
    }
    private static void prune(File directory,File root,HashSet<String> current) throws Exception {
        File[] children=directory.listFiles();if(children==null)throw new IllegalStateException("Cannot inspect current application assets");
        for(File child:children){File canonical=child.getCanonicalFile();if(!canonical.toPath().startsWith(root.toPath())||canonical.equals(root))throw new IllegalArgumentException("Current asset leaves application");if(child.isDirectory()){prune(child,root,current);File[] remaining=child.listFiles();if(remaining!=null&&remaining.length==0&&!child.delete())throw new IllegalStateException("Cannot remove stale asset directory");}else if(!current.contains(canonical.getPath())&&!child.delete())throw new IllegalStateException("Cannot remove stale application asset");}
    }
    private static String digest(InputStream stream) throws Exception {try(InputStream input=stream){MessageDigest digest=MessageDigest.getInstance("SHA-256");byte[] block=new byte[65536];int count;while((count=input.read(block))>=0)digest.update(block,0,count);StringBuilder hex=new StringBuilder();for(byte value:digest.digest())hex.append(String.format(java.util.Locale.ROOT,"%02x",value&255));return hex.toString();}}
}
