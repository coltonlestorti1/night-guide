// Extract still frames from a screen recording so they can be looked at.
//
// WHY THIS EXISTS: on 2026-08-08 a sheet was dragging sideways on Colton's
// iPhone. Four rounds of measuring in headless Chrome reported zero overflow —
// the offending element was `input[type=date]`, which iOS renders as a native
// control with an intrinsic minimum width that Chrome does not reproduce. The
// bug was structurally invisible to every tool available here. One screen
// recording showed it in minutes.
//
// ffmpeg is not installed and is not worth a dependency; AVFoundation ships
// with macOS.
//
// Usage:  swift scripts/frames.swift <video> <out-dir> [count]
// Then read the JPEGs. 12 frames covers a 30s clip well; raise it for a fast
// interaction, lower it for a long one.

import AVFoundation
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("usage: swift scripts/frames.swift <video> <out-dir> [count]")
    exit(1)
}
let url = URL(fileURLWithPath: args[1])
let outDir = args[2]
let count = args.count > 3 ? (Int(args[3]) ?? 12) : 12

try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let asset = AVURLAsset(url: url)
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
// Cap the long edge. Full-res phone frames are large enough to be wasteful to
// read, and detail beyond this does not change what you can see.
gen.maximumSize = CGSize(width: 620, height: 1340)

let dur = CMTimeGetSeconds(asset.duration)
guard dur > 0 else { print("could not read duration — is this a video?"); exit(1) }
print("duration \(String(format: "%.1f", dur))s → \(count) frames into \(outDir)")

for i in 0..<count {
    let t = dur * Double(i) / Double(max(count - 1, 1))
    let time = CMTime(seconds: min(t, dur - 0.05), preferredTimescale: 600)
    do {
        let cg = try gen.copyCGImage(at: time, actualTime: nil)
        let rep = NSBitmapImageRep(cgImage: cg)
        if let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.7]) {
            let path = String(format: "%@/f%02d_%.1fs.jpg", outDir, i, t)
            try data.write(to: URL(fileURLWithPath: path))
            print("  f\(String(format: "%02d", i))_\(String(format: "%.1f", t))s.jpg")
        }
    } catch {
        print("  frame \(i) failed: \(error.localizedDescription)")
    }
}
