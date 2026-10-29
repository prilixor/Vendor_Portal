allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    fun bumpCompileSdkAfterDsl() {
        val androidComponents = extensions.findByName("androidComponents") ?: return
        val finalizeDsl =
            androidComponents.javaClass.methods.firstOrNull { method ->
                method.name == "finalizeDsl" &&
                    method.parameterCount == 1 &&
                    Action::class.java.isAssignableFrom(method.parameterTypes[0])
            } ?: return
        finalizeDsl.invoke(
            androidComponents,
            object : Action<Any> {
                override fun execute(dsl: Any) {
                    val setter =
                        dsl.javaClass.methods.firstOrNull { method ->
                            method.name == "setCompileSdk" && method.parameterCount == 1
                        } ?: dsl.javaClass.methods.first { method ->
                            method.name == "setCompileSdkVersion" && method.parameterCount == 1
                        }
                    setter.invoke(dsl, 36)
                }
            },
        )
    }
    pluginManager.withPlugin("com.android.library") { bumpCompileSdkAfterDsl() }
    pluginManager.withPlugin("com.android.application") { bumpCompileSdkAfterDsl() }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
