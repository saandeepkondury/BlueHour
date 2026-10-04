import AppIntents
import SwiftUI
import WidgetKit

/// The hero card from the Habits page, on the home screen: tap a star to log it,
/// tap + Cup to log water, tap the plan to open it, tap the camera to log a meal.
struct HabitsWidget: Widget {
    let kind = "BlueHourHabits"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitsProvider()) { entry in
            HabitsWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Star today's habits, log water, check the plan, and snap a meal.")
        .supportedFamilies([
            .systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular,
        ])
    }
}

private enum Links {
    static let habits = URL(string: "bluehour://habits")!
    static let water = URL(string: "bluehour://water")!
    static let plan = URL(string: "bluehour://plan")!
    static let logMeal = URL(string: "bluehour://log-meal")!
    static let today = URL(string: "bluehour://today")!
}

private extension HabitsSnapshot.Habit {
    var shortName: String {
        switch id {
        case "sleep": return "Sleep"
        case "meal_prep": return "Meal prep"
        case "plan": return "Plan"
        default: return label
        }
    }

    var glyph: String {
        switch id {
        case "sleep": return "moon.zzz"
        case "meal_prep": return "takeoutbag.and.cup.and.straw"
        case "plan": return "figure.run"
        default: return "circle"
        }
    }
}

private extension HabitsSnapshot {
    var streakLine: String {
        if done == total {
            return streak > 1 ? "\(streak) day streak" : "All in today"
        }
        return "\(total - done) left today"
    }
}

private extension HabitsSnapshot.Water {
    var cupsLine: String {
        guard let cupsTarget else { return cups == 1 ? "1 cup" : "\(cups) cups" }
        return "\(cups) of \(cupsTarget) cups"
    }

    /// Small size, where "cups" doesn't fit beside the + button.
    var shortLine: String {
        guard let cupsTarget else { return "\(cups) cups" }
        return "\(cups) of \(cupsTarget)"
    }

    var ozLine: String {
        guard let target else { return "\(oz) oz today" }
        return "\(oz) of \(target) oz"
    }
}

struct HabitsWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: HabitsEntry

    var body: some View {
        content
            .containerBackground(for: .widget) {
                if isAccessory {
                    Color.clear
                } else {
                    DuskBackground()
                }
            }
    }

    private var isAccessory: Bool {
        family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline
    }

    @ViewBuilder
    private var content: some View {
        if let snapshot = entry.snapshot {
            switch family {
            case .systemSmall:
                SmallCard(snapshot: snapshot)
            case .systemLarge:
                LargeCard(snapshot: snapshot)
            case .accessoryRectangular:
                LockScreenCard(snapshot: snapshot)
            case .accessoryCircular:
                LockScreenRing(snapshot: snapshot)
            default:
                MediumCard(snapshot: snapshot)
            }
        } else {
            SignedOut(compact: isAccessory)
        }
    }
}

// MARK: - Pieces

private struct DuskBackground: View {
    var body: some View {
        ZStack {
            Palette.skyDeep
            RadialGradient(
                colors: [Palette.dawn.opacity(0.32), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 200
            )
            RadialGradient(
                colors: [Palette.sky.opacity(0.5), .clear],
                center: .bottomLeading,
                startRadius: 0,
                endRadius: 220
            )
        }
    }
}

private struct WidgetHeader: View {
    var trailing: String?

    var body: some View {
        HStack(spacing: 5) {
            BrandMark(size: 14, tone: .glyph)
            Text("Today")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.6)
                .textCase(.uppercase)
            Spacer(minLength: 4)
            if let trailing {
                Text(trailing)
                    .font(.system(size: 11, weight: .medium))
                    .lineLimit(1)
            }
        }
        .foregroundStyle(Palette.cream.opacity(0.75))
    }
}

private struct CountLine: View {
    let snapshot: HabitsSnapshot
    var size: CGFloat = 34

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(snapshot.done)")
                    .font(.system(size: size, design: .serif))
                    .contentTransition(.numericText())
                Text("of \(snapshot.total) habits")
                    .font(.system(.subheadline, design: .serif).italic())
                    .foregroundStyle(Palette.cream.opacity(0.7))
            }
            Text(snapshot.streakLine)
                .font(.caption2.weight(.medium))
                .foregroundStyle(snapshot.done == snapshot.total ? Palette.dawn : Palette.cream.opacity(0.7))
        }
        .foregroundStyle(Palette.cream)
        .invalidatableContent()
    }
}

/// One sticker slot. Empty shows the habit's glyph; starred shows a gold star.
private struct StarSlot: View {
    let habit: HabitsSnapshot.Habit
    let date: String
    var diameter: CGFloat = 36
    var showsName = true

    var body: some View {
        Button(intent: ToggleHabitIntent(habitId: habit.id, date: date, on: !habit.done)) {
            VStack(spacing: 4) {
                ZStack {
                    if habit.done {
                        Circle().fill(Palette.dawn.opacity(0.24))
                        Image(systemName: "star.fill")
                            .font(.system(size: diameter * 0.5, weight: .semibold))
                            .foregroundStyle(Palette.dawn)
                            .widgetAccentable()
                    } else {
                        Circle()
                            .strokeBorder(
                                Palette.cream.opacity(0.35),
                                style: StrokeStyle(lineWidth: 1.2, dash: [3, 3])
                            )
                        Image(systemName: habit.glyph)
                            .font(.system(size: diameter * 0.4, weight: .medium))
                            .foregroundStyle(Palette.cream.opacity(0.6))
                    }
                }
                .frame(width: diameter, height: diameter)

                if showsName {
                    Text(habit.shortName)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Palette.cream.opacity(habit.done ? 0.95 : 0.65))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(habit.label)
        .accessibilityValue(habit.done ? "Starred" : "Not starred")
        .accessibilityHint(habit.done ? "Removes today's star" : "Adds today's star")
    }
}

private struct StarRow: View {
    let snapshot: HabitsSnapshot
    var diameter: CGFloat = 36
    var showsNames = true

    var body: some View {
        HStack(spacing: 4) {
            ForEach(snapshot.habits) { habit in
                StarSlot(habit: habit, date: snapshot.date, diameter: diameter, showsName: showsNames)
            }
        }
    }
}

private struct WaterBar: View {
    let progress: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Palette.cream.opacity(0.16))
                Capsule()
                    .fill(Palette.mist)
                    .frame(width: max(proxy.size.width * progress, progress > 0 ? 4 : 0))
                    .widgetAccentable()
            }
        }
        .frame(height: 4)
    }
}

/// The whole pill is the + Cup button; one tap logs 18 oz without opening the app.
private struct CupButton: View {
    let water: HabitsSnapshot.Water
    let date: String
    var showsBar = true

    var body: some View {
        Button(intent: LogCupIntent(date: date)) {
            HStack(spacing: 7) {
                Image(systemName: water.isDone ? "drop.fill" : "drop")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Palette.mist)
                    .widgetAccentable()
                VStack(alignment: .leading, spacing: 3) {
                    Text(showsBar ? water.cupsLine : water.shortLine)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Palette.cream)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .contentTransition(.numericText())
                        .invalidatableContent()
                    if showsBar {
                        WaterBar(progress: water.progress)
                    }
                }
                Spacer(minLength: 2)
                Image(systemName: "plus")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Palette.skyDeep)
                    .frame(width: 22, height: 22)
                    .background(Palette.mist, in: Circle())
            }
            .padding(.leading, 11)
            .padding(.trailing, 6)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Palette.cream.opacity(0.1), in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Log a cup of water")
        .accessibilityValue(water.ozLine)
    }
}

private struct PlanCard: View {
    let plan: HabitsSnapshot.Plan?
    var compact = false

    var body: some View {
        Group {
            if compact {
                compactBody
            } else {
                fullBody
            }
        }
        .background(Palette.cream.opacity(0.1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens the plan")
    }

    private var icon: String {
        plan?.done == true ? "checkmark.circle.fill" : "calendar"
    }

    /// Medium size: icon and title on one line so the card matches the star row's height.
    private var compactBody: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Palette.dawn)
                Text(plan?.title ?? "Open the plan")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.cream)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            if let detail = plan?.detail {
                Text(detail)
                    .font(.caption2)
                    .foregroundStyle(Palette.cream.opacity(0.7))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var fullBody: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                Text("Plan")
                    .textCase(.uppercase)
                    .tracking(0.4)
            }
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(Palette.dawn)

            Text(plan?.title ?? "Open the plan")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Palette.cream)
                .lineLimit(2)
                .minimumScaleFactor(0.85)

            if let detail = plan?.detail {
                Text(detail)
                    .font(.caption2)
                    .foregroundStyle(Palette.cream.opacity(0.7))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct LogMealButton: View {
    let logged: Int

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "camera.fill")
            Text("Log meal")
        }
        .font(.footnote.weight(.semibold))
        .foregroundStyle(Palette.skyDeep)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.cream, in: Capsule())
        .accessibilityLabel("Log a meal photo")
        .accessibilityValue(logged == 1 ? "1 meal logged today" : "\(logged) meals logged today")
    }
}

// MARK: - Home screen sizes

private struct SmallCard: View {
    let snapshot: HabitsSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(snapshot.done)")
                    .font(.system(size: 28, design: .serif))
                    .contentTransition(.numericText())
                Text("of \(snapshot.total)")
                    .font(.system(.footnote, design: .serif).italic())
                    .foregroundStyle(Palette.cream.opacity(0.7))
                Spacer(minLength: 0)
                BrandMark(size: 15, tone: .glyph)
                    .opacity(0.8)
                    .accessibilityHidden(true)
            }
            .foregroundStyle(Palette.cream)
            .invalidatableContent()

            Spacer(minLength: 4)
            StarRow(snapshot: snapshot, diameter: 34, showsNames: false)
            Spacer(minLength: 8)

            if let water = snapshot.water {
                CupButton(water: water, date: snapshot.date, showsBar: false)
                    .frame(height: 32)
            }
        }
        .widgetURL(Links.habits)
    }
}

private struct MediumCard: View {
    let snapshot: HabitsSnapshot

    var body: some View {
        VStack(spacing: 8) {
            WidgetHeader(
                trailing: snapshot.done == snapshot.total
                    ? snapshot.streakLine
                    : "\(snapshot.done) of \(snapshot.total) habits"
            )

            HStack(spacing: 10) {
                StarRow(snapshot: snapshot)
                    .frame(maxWidth: .infinity)
                Link(destination: Links.plan) {
                    PlanCard(plan: snapshot.plan, compact: true)
                }
                .frame(width: 140, height: 52)
            }

            HStack(spacing: 10) {
                if let water = snapshot.water {
                    CupButton(water: water, date: snapshot.date)
                }
                Link(destination: Links.logMeal) {
                    LogMealButton(logged: snapshot.mealsLogged ?? 0)
                }
                .frame(width: 140)
            }
            .frame(height: 36)
        }
        .widgetURL(Links.habits)
    }
}

private struct LargeCard: View {
    let snapshot: HabitsSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            WidgetHeader()
            CountLine(snapshot: snapshot, size: 36)
            StarRow(snapshot: snapshot, diameter: 48)

            if let water = snapshot.water {
                WaterPanel(water: water, date: snapshot.date)
            }

            HStack(spacing: 10) {
                Link(destination: Links.plan) {
                    PlanCard(plan: snapshot.plan)
                }
                Link(destination: Links.logMeal) {
                    VStack(spacing: 6) {
                        Image(systemName: "camera.fill")
                            .font(.title3)
                        Text("Log meal")
                            .font(.footnote.weight(.semibold))
                    }
                    .foregroundStyle(Palette.skyDeep)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Palette.cream, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("Log a meal photo")
                }
                .frame(width: 104)
            }
        }
        .widgetURL(Links.habits)
    }
}

/// Large size only: a row of cups that fill in as you drink, plus + Cup.
private struct WaterPanel: View {
    let water: HabitsSnapshot.Water
    let date: String

    var body: some View {
        HStack(spacing: 10) {
            Link(destination: Links.water) {
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 4) {
                        Image(systemName: "drop.fill")
                        Text("Water")
                            .textCase(.uppercase)
                            .tracking(0.4)
                        Spacer(minLength: 4)
                        Text(water.ozLine)
                            .foregroundStyle(Palette.cream.opacity(0.7))
                            .tracking(0)
                            .textCase(nil)
                    }
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Palette.mist)

                    if let cupsTarget = water.cupsTarget, cupsTarget <= 12 {
                        HStack(spacing: 5) {
                            ForEach(0..<max(cupsTarget, water.cups), id: \.self) { index in
                                Image(systemName: index < water.cups ? "drop.fill" : "drop")
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundStyle(index < water.cups ? Palette.mist : Palette.cream.opacity(0.35))
                                    .widgetAccentable(index < water.cups)
                            }
                        }
                        .invalidatableContent()
                    } else {
                        WaterBar(progress: water.progress)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Water, \(water.cupsLine)")
                .accessibilityHint("Opens Water")
            }

            Button(intent: LogCupIntent(date: date)) {
                HStack(spacing: 4) {
                    Image(systemName: "plus")
                    Text("Cup")
                }
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Palette.skyDeep)
                .padding(.horizontal, 14)
                .frame(height: 36)
                .background(Palette.mist, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Log a cup of water")
        }
        .padding(12)
        .background(Palette.cream.opacity(0.1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct SignedOut: View {
    let compact: Bool

    var body: some View {
        Group {
            if compact {
                Image(systemName: "star")
                    .font(.title3)
                    .accessibilityLabel("Sign in to Blue Hour to see today")
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    BrandMark(size: 24, tone: .glyph)
                    Spacer(minLength: 0)
                    Text("Sign in to Blue Hour")
                        .font(.footnote.weight(.semibold))
                    Text("Open the app once and your stars and water show up here.")
                        .font(.caption2)
                        .foregroundStyle(Palette.cream.opacity(0.7))
                }
                .foregroundStyle(Palette.cream)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .widgetURL(Links.today)
    }
}

// MARK: - Lock screen

private struct LockScreenCard: View {
    let snapshot: HabitsSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 3) {
                ForEach(snapshot.habits) { habit in
                    Image(systemName: habit.done ? "star.fill" : "star")
                        .widgetAccentable(habit.done)
                }
                Text("\(snapshot.done) of \(snapshot.total)")
                    .padding(.leading, 2)
            }
            .font(.headline)

            if let water = snapshot.water {
                Label(water.cupsLine, systemImage: "drop.fill")
                    .font(.caption)
            }
            if let plan = snapshot.plan {
                Text(plan.title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .widgetURL(Links.habits)
    }
}

private struct LockScreenRing: View {
    let snapshot: HabitsSnapshot

    var body: some View {
        Gauge(value: Double(snapshot.done), in: 0...Double(max(snapshot.total, 1))) {
            Image(systemName: "star.fill")
        } currentValueLabel: {
            Text("\(snapshot.done)")
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .accessibilityLabel("\(snapshot.done) of \(snapshot.total) habits starred today")
        .widgetURL(Links.habits)
    }
}

// MARK: - Previews

#Preview("Medium", as: .systemMedium) {
    HabitsWidget()
} timeline: {
    HabitsEntry(date: .now, snapshot: .sample)
    HabitsEntry(date: .now, snapshot: HabitsSnapshot.sample.settingStar("plan", on: true))
    HabitsEntry(date: .now, snapshot: nil)
}

#Preview("Small", as: .systemSmall) {
    HabitsWidget()
} timeline: {
    HabitsEntry(date: .now, snapshot: .sample)
}

#Preview("Large", as: .systemLarge) {
    HabitsWidget()
} timeline: {
    HabitsEntry(date: .now, snapshot: .sample)
}

#Preview("Lock screen", as: .accessoryRectangular) {
    HabitsWidget()
} timeline: {
    HabitsEntry(date: .now, snapshot: .sample)
}
