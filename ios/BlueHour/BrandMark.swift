import SwiftUI

/// Waxing crescent over a Hill Country ridge — matches the web seal.
struct BrandMark: View {
    var size: CGFloat = 64
    var tone: Tone = .seal

    enum Tone {
        case seal
        case glyph
    }

    var body: some View {
        Canvas { context, canvasSize in
            let scale = min(canvasSize.width, canvasSize.height) / 64
            let transform = CGAffineTransform(scaleX: scale, y: scale)
            let ink = Palette.cream

            if tone == .seal {
                let disc = Path(ellipseIn: CGRect(x: 0, y: 0, width: 64, height: 64)).applying(transform)
                context.fill(disc, with: .color(Palette.sky))
                context.clip(to: disc)
            }

            var crescent = Path(ellipseIn: CGRect(x: 12.2, y: 10.2, width: 21.6, height: 21.6))
            crescent.addPath(Path(ellipseIn: CGRect(x: 19.8, y: 9.6, width: 18.8, height: 18.8)))
            context.fill(
                crescent.applying(transform),
                with: .color(ink),
                style: FillStyle(eoFill: true)
            )
            context.fill(
                Self.ridge.applying(transform),
                with: .color(tone == .seal ? Palette.limestone : ink)
            )
        }
        .frame(width: size, height: size)
        .accessibilityLabel("Blue Hour")
    }

    private static var ridge: Path {
        var path = Path()
        path.move(to: CGPoint(x: 0, y: 46.2))
        path.addCurve(
            to: CGPoint(x: 25, y: 39.5),
            control1: CGPoint(x: 11, y: 43),
            control2: CGPoint(x: 17, y: 44.5)
        )
        path.addCurve(
            to: CGPoint(x: 44, y: 32.2),
            control1: CGPoint(x: 32, y: 35.2),
            control2: CGPoint(x: 38, y: 37.5)
        )
        path.addCurve(
            to: CGPoint(x: 64, y: 27.3),
            control1: CGPoint(x: 51, y: 26.5),
            control2: CGPoint(x: 57, y: 29.5)
        )
        path.addLine(to: CGPoint(x: 64, y: 64))
        path.addLine(to: CGPoint(x: 0, y: 64))
        path.closeSubpath()
        return path
    }
}

enum Palette {
    static let sky = Color(red: 0.184, green: 0.427, blue: 0.600)
    static let skyDeep = Color(red: 0.086, green: 0.196, blue: 0.290)
    static let cream = Color(red: 0.953, green: 0.937, blue: 0.902)
    static let limestone = Color(red: 0.902, green: 0.867, blue: 0.816)
    static let dawn = Color(red: 0.831, green: 0.659, blue: 0.416)
    static let warn = Color(red: 0.957, green: 0.812, blue: 0.616)
}
