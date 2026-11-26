# GYMTRACK – New Feature Implementation

Act as a senior full-stack developer. I already have an existing GYMTRACK application. I want you to extend it with the following features.

**IMPORTANT:**
- Do NOT rebuild the application from scratch.
- Do NOT remove or break existing functionality.
- Preserve the existing design, colors, navigation and overall architecture.
- Integrate all new features into the existing application.
- Inspect the current project structure and database before making changes.
- Make all features fully functional, not just visual prototypes.
- Ensure compatibility with iPhone, Android and desktop browsers.

## 1. ADVANCED WORKOUT TRACKING

Extend the existing workout tracker to support different training techniques.

### Normal sets
- Allow users to add, edit and delete sets.
- Record weight, repetitions and completed status.
- Allow individual rest durations.

### Supersets
- Allow users to group two or more exercises into a superset.
- Display grouped exercises clearly.
- Allow users to complete exercises consecutively.
- Start the rest timer after completing the entire superset.
- Allow users to edit or remove exercises from a superset.

### Dropsets
- Allow users to create dropsets within an exercise.
- Record multiple weight reductions and repetitions.
- Example: 20 kg × 10 reps, 15 kg × 8 reps, 10 kg × 8 reps.
- Group all dropset stages visually.
- Do not treat each stage as an independent exercise.

### Additional training techniques
Support:
- Giant sets.
- Rest-pause sets.
- Myo-reps.
- Tempo training.

Allow users to select the training technique when creating or editing exercises.

## 2. ADVANCED REST TIMER

Improve the existing rest timer.

Requirements:
- Configurable rest duration.
- Circular countdown interface.
- Start, pause, resume and reset.
- Sound alarm when the timer reaches zero.
- Vibration when supported by the device.
- Browser notification when permission is granted.
- Option to select different alarm sounds.
- Option to enable or disable sound and vibration.
- Automatically start the timer after completing a set.
- Allow users to skip rest.
- Allow users to add or subtract 15 seconds.

IMPORTANT:
The timer must be designed for PWA compatibility on iOS and Android.

Test background and locked-screen behavior. Do not assume JavaScript timers or custom audio will continue running when iOS suspends the application.

Use Web Push notifications as a fallback where appropriate, but do not promise that push notifications can play a custom ringtone.

## 3. PERSONALIZED NUTRITION TRACKER

Create a comprehensive food and nutrition module.

### Food database
Allow users to:
- Search for foods by name.
- Browse food categories.
- Select foods from a large database.
- Add custom foods manually.
- Save favorite foods.
- Save frequently used meals.

Integrate Open Food Facts or another suitable nutrition database API.

### Food quantities
When selecting a food, allow the user to enter the quantity in grams.

Automatically calculate:
- Calories.
- Protein.
- Carbohydrates.
- Fat.

Use the nutritional values per 100 grams to calculate the actual nutritional values for the selected quantity.

### Meals
Create categories:
- Breakfast.
- Lunch.
- Dinner.
- Snacks.

Allow users to:
- Add multiple foods to each meal.
- Edit quantities.
- Remove foods.
- Duplicate previous meals.
- Save custom meals.
- Review previous days.

### Daily nutrition dashboard
Display:
- Total calories consumed.
- Protein consumed.
- Carbohydrates consumed.
- Fat consumed.
- Daily targets.
- Remaining calories and macros.

Allow users to customize their daily nutritional targets.

## 4. EXPANDED EXERCISE LIBRARY

Improve the existing exercise database.

Include:
- Chest.
- Back.
- Shoulders.
- Biceps.
- Triceps.
- Quadriceps.
- Hamstrings.
- Glutes.
- Calves.
- Abs.
- Forearms.
- Cardio.

Each exercise should have:
- Name.
- Primary muscle group.
- Secondary muscles.
- Equipment.
- Instructions.
- Images or illustrations where available.
- Difficulty level.
- Exercise category.

Add filters for:
- Muscle group.
- Equipment.
- Exercise type.
- Difficulty.

### Custom exercises
Allow users to:
- Create their own exercises.
- Upload an exercise image.
- Specify the targeted muscles.
- Select equipment.
- Edit or delete custom exercises.

Do not create duplicate exercises when a custom exercise already exists.

## 5. DATABASE AND DATA INTEGRITY

Inspect the existing database schema before modifying it.

Implement the necessary database changes for:
- Superset grouping.
- Dropset stages.
- Training techniques.
- Rest timer preferences.
- Food database.
- Custom foods.
- Meal records.
- Meal items.
- Nutritional targets.
- Custom exercises.

Preserve existing workout history.

Use appropriate database relationships and migrations.

If Supabase is used:
- Implement Row Level Security.
- Ensure users can only access their own private data.
- Avoid exposing service-role credentials in frontend code.

## 6. MOBILE AND PWA EXPERIENCE

Ensure all new features work on:
- iPhone.
- Android.
- Desktop.

Requirements:
- Responsive mobile-first design.
- Touch-friendly controls.
- Smooth navigation.
- Proper loading states.
- Offline support for workout recording.
- Local persistence of unfinished workouts.
- Synchronization when internet connectivity returns.

## 7. DEVELOPMENT AND TESTING

Work in phases.

Before implementation:
1. Inspect the existing project.
2. Understand the current architecture.
3. Identify reusable components.
4. Review the database.
5. Explain the planned changes.

During implementation:
- Reuse existing components whenever possible.
- Maintain the existing visual identity.
- Write clean, maintainable code.
- Avoid unnecessary dependencies.
- Handle errors properly.
- Keep existing functionality working.

After implementation:
- Test normal sets.
- Test supersets.
- Test dropsets.
- Test rest timer behavior.
- Test food calculations.
- Test custom foods.
- Test custom exercises.
- Test mobile layouts.
- Test offline workout persistence.
- Fix errors and regressions.

**FINAL OBJECTIVE:**

Transform the existing GYMTRACK application into an advanced personal fitness platform with professional workout tracking, advanced training techniques, a powerful nutrition tracker and a comprehensive exercise library.

Do not stop at planning. Implement the features in the existing codebase and verify that they work.